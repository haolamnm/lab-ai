import { haversine } from './geo'
import {
  costIsFlat, edgeCost, edgeMinutes, passable, PERIODS, ROAD_LABEL, turnAllowed, VEHICLES,
  type Conditions,
} from './traffic'
import type { AlgoKey, Graph, GraphEdge, RouteResult, TraceStep } from './types'

interface AlgorithmInfo {
  key: AlgoKey
  name: string
  optimal: boolean
  note: string
  hue: string
  /** Exists only in the Python backend, so the browser can plan nothing for it.
   *  A flag here rather than an `algo === 'held_karp'` test in five UI files. */
  backendOnly?: true
  /** Ceiling the algorithm itself imposes on the number of stops — Held–Karp is
   *  O(n²·2ⁿ) in them. Mirrors `MAX_HELD_KARP_STOPS` in the Python planner, which
   *  is still the one that enforces it; this only warns before Run is pressed. */
  maxStops?: number
  /** What the reported runtime actually measures, when it is not simply "the
   *  search". Held–Karp times the legs it ended up choosing, which is neither the
   *  full pairwise search nor the DP. */
  msNote?: string
  /** How the optimality guarantee reads, when the bare word "optimal" would let a
   *  reader assume the wrong one. Prefixed with the algorithm's name where shown. */
  optimalityNote?: string
}

/**
 * Metadata used by the pane selector, the pane footer, and the explanation.
 *
 * Keyed by `AlgoKey` rather than searched with `ALGOS.find(a => a.key === k)!`:
 * a seventh algorithm added to the union and forgotten here is now a compile
 * error instead of an `undefined` surfacing inside a render pass.
 *
 * The declaration order is the order `addPane` hands algorithms out in and the
 * order the pane selector lists them — the two that produce an optimal
 * point-to-point route first, since those are the ones a comparison starts from.
 * A separate hand-written order list is how a new algorithm gets counted towards
 * the pane cap while never actually being handed to a pane.
 */
export const ALGOS: Record<AlgoKey, AlgorithmInfo> = {
  astar: { key: 'astar', name: 'A*', optimal: true, hue: '#0a736f', note: 'Optimal, guided by a lower-bound heuristic' },
  ucs: { key: 'ucs', name: 'UCS', optimal: true, hue: '#1e5fa8', note: 'Optimal; this is Dijkstra search' },
  bfs: { key: 'bfs', name: 'BFS', optimal: false, hue: '#b0651c', note: 'Fewest hops, ignores cost' },
  dfs: { key: 'dfs', name: 'DFS', optimal: false, hue: '#a33b62', note: 'Plunges down one branch, usually a poor route' },
  nearest: { key: 'nearest', name: 'Nearest Neighbor', optimal: false, hue: '#527326', note: 'Orders stops greedily by exact route cost; each leg is then routed exactly' },
  held_karp: {
    key: 'held_karp', name: 'Held–Karp DP', optimal: true, hue: '#b45309',
    note: 'Exact cheapest visit order, from pairwise A* costs and bitmask DP. Backend only',
    backendOnly: true,
    maxStops: 12,
    msNote: 'Runtime of the A* legs on the chosen tour — not the full pairwise search, and not the DP',
    optimalityNote: 'is exact over the visit order: it costs every ordered pair of trip points with A*, then evaluates every possible tour through them, so no tour over these stops is cheaper than this one. Each leg of the tour is itself an optimal A* route. The timeline replays those chosen leg searches — the bitmask DP table is not part of the result.',
  },
}

/**
 * Said once, wherever a backend-only algorithm is asked for and none is
 * configured. Four places used to carry their own wording of it — the sidebar
 * notice, both comparison tables, and the result this planner returns below —
 * so the same situation was explained four slightly different ways.
 */
export function backendOnlyNote(algo: AlgoKey): string {
  return `${ALGOS[algo].name} runs only on the Python backend, and none is configured. `
    + 'Set VITE_API_URL, start the server in server/, then reload.'
}

/**
 * How long the inputs must hold still before the comparison tables replan.
 *
 * Every input they watch can change many times a second — the weight sliders
 * fire on each input event — and one recomputation is four or five whole trips,
 * each carrying the entire road network to the backend. Long enough that
 * dragging a slider across its range costs one run, not thirty.
 */
export const SETTLE_MS = 350

const indexCache = new WeakMap<Graph, { ids: string[]; of: Record<string, number> }>()

function indexer(graph: Graph) {
  let cached = indexCache.get(graph)
  if (!cached) {
    const ids = Object.keys(graph.nodes)
    const of: Record<string, number> = {}
    ids.forEach((id, index) => { of[id] = index })
    cached = { ids, of }
    indexCache.set(graph, cached)
  }
  return cached
}

interface HeapEntry {
  id: string
  priority: number
  cost: number
}

/** Binary min-heap. Improved states leave stale entries that are skipped when popped. */
class Heap {
  private entries: HeapEntry[] = []

  get size() { return this.entries.length }

  /** Priority at a slot, or +∞ past the end — an absent child then loses every
   *  comparison, which is exactly how a missing child should behave. */
  private priorityAt(index: number): number {
    return this.entries[index]?.priority ?? Infinity
  }

  private swap(a: number, b: number) {
    const first = this.entries[a], second = this.entries[b]
    if (first === undefined || second === undefined) return
    this.entries[a] = second
    this.entries[b] = first
  }

  push(id: string, priority: number, cost: number) {
    this.entries.push({ id, priority, cost })
    let index = this.entries.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.priorityAt(parent) <= this.priorityAt(index)) break
      this.swap(parent, index)
      index = parent
    }
  }

  /** Undefined on an empty heap, rather than a value the caller has to trust
   *  exists — the only caller already loops on `size`. */
  pop(): HeapEntry | undefined {
    const first = this.entries[0]
    const last = this.entries.pop()
    if (last === undefined || !this.entries.length) return first

    this.entries[0] = last
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < this.entries.length && this.priorityAt(left) < this.priorityAt(smallest)) smallest = left
      if (right < this.entries.length && this.priorityAt(right) < this.priorityAt(smallest)) smallest = right
      if (smallest === index) break
      this.swap(smallest, index)
      index = smallest
    }
    return first
  }
}

function minCostPerKm(graph: Graph, conditions: Conditions): number {
  let cheapest = Infinity
  for (const edge of graph.edges) {
    if (!passable(edge, conditions.vehicle, conditions.period) || edge.km <= 0) continue
    cheapest = Math.min(cheapest, edgeCost(edge, conditions) / edge.km)
  }
  return Number.isFinite(cheapest) ? cheapest : 0
}

interface SearchLegResult {
  path: string[]
  edges: GraphEdge[]
  trace: TraceStep[]
  found: boolean
  ms: number
  turnsBlocked: number
}

/** Shared graph bookkeeping. Each algorithm still owns its frontier and expansion loop. */
interface SearchMemory {
  graph: Graph
  conditions: Conditions
  nodeIndex: Record<string, number>
  keyOf: (node: string, incoming: GraphEdge | null) => string
  startKey: string
  nodeAt: Record<string, string>
  parent: Record<string, string | null>
  via: Record<string, GraphEdge | null>
  cost: Record<string, number>
  closed: Set<string>
  open: Set<string>
  trace: TraceStep[]
  turnsBlocked: number
}

function createSearchMemory(
  graph: Graph, start: string, conditions: Conditions,
): SearchMemory {
  // A turn rule constrains the outgoing road based on the incoming road. The
  // state therefore includes both values whenever this graph carries rules.
  const turnsActive = !!graph.turns
    && (Object.keys(graph.turns.no).length > 0 || Object.keys(graph.turns.only).length > 0)
  const keyOf = (node: string, incoming: GraphEdge | null) =>
    turnsActive ? `${node}|${incoming?.wayId ?? ''}` : node
  const startKey = keyOf(start, null)

  return {
    graph,
    conditions,
    nodeIndex: indexer(graph).of,
    keyOf,
    startKey,
    nodeAt: { [startKey]: start },
    parent: { [startKey]: null },
    via: { [startKey]: null },
    cost: { [startKey]: 0 },
    closed: new Set(),
    open: new Set([startKey]),
    trace: [],
    turnsBlocked: 0,
  }
}

/** Returns legal outgoing states and records directions rejected by turn rules. */
function nextStates(memory: SearchMemory, current: string) {
  const at = memory.nodeAt[current]
  const incoming = memory.via[current] ?? null
  const next: { edge: GraphEdge; key: string }[] = []
  // A state whose intersection was never recorded has no roads leading out of
  // it. `remember` writes it before the state can reach any frontier, so this is
  // an invariant restated as a branch rather than asserted away.
  if (at === undefined) return next

  for (const edge of memory.graph.adj[at] ?? []) {
    if (!passable(edge, memory.conditions.vehicle, memory.conditions.period)) continue
    if (incoming && !turnAllowed(memory.graph.turns, at, incoming, edge, memory.conditions)) {
      memory.turnsBlocked++
      continue
    }
    const key = memory.keyOf(edge.to, edge)
    if (!memory.closed.has(key)) next.push({ edge, key })
  }
  return next
}

function remember(
  memory: SearchMemory,
  key: string,
  current: string,
  edge: GraphEdge,
  cost: number,
) {
  memory.cost[key] = cost
  memory.parent[key] = current
  memory.via[key] = edge
  memory.nodeAt[key] = edge.to
  memory.open.add(key)
}

/** Records one expansion in the format consumed by the map and tree timeline. */
function recordExpansion(
  memory: SearchMemory, current: string, heuristic: number | null = null,
) {
  memory.closed.add(current)
  memory.open.delete(current)
  const expanded = indexOfState(memory, current)
  // Nothing the timeline could draw: a state with no recorded intersection, or
  // one outside this graph's node index. Neither is reachable, and the branch
  // costs less than the two assertions it replaces.
  if (expanded === undefined) return
  const parentKey = memory.parent[current] ?? null
  const parent = parentKey === null ? undefined : indexOfState(memory, parentKey)
  memory.trace.push({
    expanded,
    frontier: [...memory.open].flatMap(key => {
      const index = indexOfState(memory, key)
      return index === undefined ? [] : [index]
    }),
    g: +(memory.cost[current] ?? 0).toFixed(3),
    h: heuristic == null ? null : +heuristic.toFixed(3),
    parent: parent ?? null,
  })
}

/** The graph-node index a search state sits at, for the trace's compact form. */
function indexOfState(memory: SearchMemory, key: string): number | undefined {
  const at = memory.nodeAt[key]
  return at === undefined ? undefined : memory.nodeIndex[at]
}

function popFresh(frontier: Heap, memory: SearchMemory): string | undefined {
  while (frontier.size) {
    const entry = frontier.pop()
    if (entry === undefined) return undefined
    if (!memory.closed.has(entry.id) && entry.cost === memory.cost[entry.id]) return entry.id
  }
  return undefined
}

function completeLeg(
  memory: SearchMemory, goalKey: string | null, startedAt: number,
): SearchLegResult {
  const path: string[] = []
  const edges: GraphEdge[] = []

  // Keep the exact edge objects selected by the algorithm. Looking an edge up
  // again by node pair is wrong when parallel roads join the same intersections.
  for (let current = goalKey; current != null; current = memory.parent[current] ?? null) {
    const at = memory.nodeAt[current]
    if (at === undefined) break
    path.unshift(at)
    const edge = memory.via[current]
    if (edge) edges.unshift(edge)
  }

  return {
    path,
    edges,
    trace: memory.trace,
    found: goalKey != null,
    turnsBlocked: memory.turnsBlocked,
    ms: performance.now() - startedAt,
  }
}

/** Breadth-First Search: a FIFO queue produces the fewest-hop path. */
function breadthFirstSearch(
  graph: Graph, start: string, goal: string, conditions: Conditions,
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const queue = [memory.startKey]
  let head = 0

  while (head < queue.length) {
    const current = queue[head++]
    if (current === undefined || memory.closed.has(current)) continue
    recordExpansion(memory, current)
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      if (key in memory.cost) continue
      remember(memory, key, current, edge, (memory.cost[current] ?? 0) + 1)
      queue.push(key)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** Depth-First Search: a LIFO stack explores the newest branch first. */
function depthFirstSearch(
  graph: Graph, start: string, goal: string, conditions: Conditions,
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const stack = [memory.startKey]

  while (stack.length) {
    const current = stack.pop()
    if (current === undefined || memory.closed.has(current)) continue
    recordExpansion(memory, current)
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      if (key in memory.cost) continue
      remember(memory, key, current, edge, (memory.cost[current] ?? 0) + 1)
      stack.push(key)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** Uniform Cost Search: Dijkstra priority `g(n)` returns a minimum-cost path. */
function uniformCostSearch(
  graph: Graph, start: string, goal: string, conditions: Conditions,
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const frontier = new Heap()
  frontier.push(memory.startKey, 0, 0)

  for (let current = popFresh(frontier, memory); current !== undefined;
    current = popFresh(frontier, memory)) {
    recordExpansion(memory, current)
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = (memory.cost[current] ?? 0) + edgeCost(edge, conditions)
      // One read instead of an `in` test followed by an index the compiler had
      // to be told could not miss. Same rule: only relax a state we can beat.
      const known = memory.cost[key]
      if (known !== undefined && candidate >= known) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, candidate, candidate)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** A* Search: priority `g(n) + h(n)` keeps UCS optimality with less exploration. */
function aStarSearch(
  graph: Graph,
  start: string,
  goal: string,
  conditions: Conditions,
  heuristicScale = minCostPerKm(graph, conditions),
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const target = graph.nodes[goal]
  const estimate = (key: string) => {
    const at = memory.nodeAt[key]
    const node = at === undefined ? undefined : graph.nodes[at]
    // Zero for a node this graph does not hold. A zero heuristic is admissible,
    // so an unknown node degrades A* to UCS for that state rather than making
    // it unsound — the one fallback here that is safe in the direction it errs.
    return node && target ? heuristicScale * haversine(node, target) : 0
  }
  const frontier = new Heap()
  frontier.push(memory.startKey, estimate(memory.startKey), 0)

  for (let current = popFresh(frontier, memory); current !== undefined;
    current = popFresh(frontier, memory)) {
    recordExpansion(memory, current, estimate(current))
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = (memory.cost[current] ?? 0) + edgeCost(edge, conditions)
      // One read instead of an `in` test followed by an index the compiler had
      // to be told could not miss. Same rule: only relax a state we can beat.
      const known = memory.cost[key]
      if (known !== undefined && candidate >= known) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, candidate + estimate(key), candidate)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/**
 * The algorithms that route a single leg.
 *
 * Two keys are excluded because neither is a point-to-point search: `nearest`
 * only chooses a stop order and leaves the routing to UCS, and `held_karp` only
 * chooses the visit order and leaves the routing to A*. Keeping them out of the
 * type is what makes the `switch` below exhaustive without a `default`, so
 * adding a trip-level algorithm to `AlgoKey` and forgetting it here is a
 * compile error rather than a leg silently planned by the wrong algorithm.
 */
type PointSearchKey = Exclude<AlgoKey, 'nearest' | 'held_karp'>

/** Dispatches one trip leg without mixing algorithm control flow. */
function runPointSearch(
  algorithm: PointSearchKey,
  graph: Graph,
  start: string,
  goal: string,
  conditions: Conditions,
  heuristicScale: number,
): SearchLegResult {
  switch (algorithm) {
    case 'bfs': return breadthFirstSearch(graph, start, goal, conditions)
    case 'dfs': return depthFirstSearch(graph, start, goal, conditions)
    case 'ucs': return uniformCostSearch(graph, start, goal, conditions)
    case 'astar': return aStarSearch(graph, start, goal, conditions, heuristicScale)
  }
}

export function edgeBetween(graph: Graph, from: string, to: string): GraphEdge | undefined {
  return graph.adj[from]?.find(edge => edge.to === to)
}

function reaches(
  graph: Graph, start: string, goal: string, allow: (edge: GraphEdge) => boolean,
): boolean {
  const seen = new Set([start])
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    if (current === undefined) continue
    if (current === goal) return true
    for (const edge of graph.adj[current] ?? []) {
      if (allow(edge) && !seen.has(edge.to)) {
        seen.add(edge.to)
        queue.push(edge.to)
      }
    }
  }
  return false
}

/** Explains whether a failed leg is disconnected, one-way, or vehicle-restricted. */
function whyBlocked(graph: Graph, from: string, to: string, conditions: Conditions): string {
  if (!reaches(graph, from, to, () => true)) {
    const reverse: Record<string, string[]> = {}
    for (const edge of graph.edges) (reverse[edge.to] ??= []).push(edge.from)
    const seen = new Set([from])
    const queue = [from]
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]
      if (current === undefined) continue
      for (const edge of graph.adj[current] ?? []) {
        if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to) }
      }
      for (const previous of reverse[current] ?? []) {
        if (!seen.has(previous)) { seen.add(previous); queue.push(previous) }
      }
    }
    if (seen.has(to)) {
      return 'The two points are connected, but only by one-way streets running the wrong direction. '
        + 'Rebuild the network at a higher detail level to get more alternate routes.'
    }
    return 'The road network is disconnected between the two points. Rebuild the network at a '
      + 'different detail level, or choose two points closer together.'
  }

  const vehicle = VEHICLES[conditions.vehicle]
  const availablePeriods = Object.values(PERIODS).filter(period => period.key !== conditions.period
    && reaches(graph, from, to, edge => passable(edge, conditions.vehicle, period.key)))
  if (availablePeriods.length && vehicle.curfew) {
    return `${vehicle.curfew.note}. Switch to the `
      + `${availablePeriods.map(period => period.name.toLowerCase()).join(' or ')} period.`
  }

  const otherVehicles = Object.values(VEHICLES).filter(candidate => candidate.key !== conditions.vehicle
    && reaches(graph, from, to, edge => passable(edge, candidate.key, conditions.period)))
  const banned = vehicle.banned.map(roadClass => ROAD_LABEL[roadClass]).join(' and ')
    || 'a restricted road'
  if (!otherVehicles.length) {
    return `Every connecting route passes through ${banned}, and no listed vehicle can get through. `
      + 'Rebuild the network at a higher detail level.'
  }
  return `${vehicle.name} cannot get through because every connecting route passes through ${banned}. `
    + `Switch to ${otherVehicles.map(candidate => candidate.name.toLowerCase()).join(' or ')}.`
}

function statsOf(edges: GraphEdge[], conditions: Conditions) {
  let km = 0
  let minutes = 0
  let cost = 0
  for (const edge of edges) {
    km += edge.km
    minutes += edgeMinutes(edge, conditions)
    cost += edgeCost(edge, conditions)
  }
  return { km, minutes, cost }
}

/** One UCS sweep obtains exact costs to every unvisited nearest-neighbor candidate. */
function ucsCostsToTargets(
  graph: Graph,
  start: string,
  targets: ReadonlySet<string>,
  conditions: Conditions,
): Map<string, number> {
  const result = new Map<string, number>()
  if (!targets.size) return result

  const memory = createSearchMemory(graph, start, conditions)
  const frontier = new Heap()
  frontier.push(memory.startKey, 0, 0)

  for (let current = popFresh(frontier, memory); current !== undefined;
    current = popFresh(frontier, memory)) {
    memory.closed.add(current)
    const at = memory.nodeAt[current]
    const cost = memory.cost[current]
    if (at !== undefined && cost !== undefined && targets.has(at) && !result.has(at))
      result.set(at, cost)
    if (result.size === targets.size) break

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = (memory.cost[current] ?? 0) + edgeCost(edge, conditions)
      // One read instead of an `in` test followed by an index the compiler had
      // to be told could not miss. Same rule: only relax a state we can beat.
      const known = memory.cost[key]
      if (known !== undefined && candidate >= known) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, candidate, candidate)
    }
  }
  return result
}

/**
 * Returns a traffic-aware nearest-neighbor stop order.
 *
 * Every decision chooses the unvisited stop with the lowest exact UCS route
 * cost from the current location. The decision is locally cheapest, while the
 * full order remains a heuristic and has no global optimality guarantee.
 */
function nearestNeighborOrder(
  graph: Graph, start: string, stops: string[], conditions: Conditions,
): string[] {
  const remaining = [...stops]
  const order: string[] = []
  let current = start

  while (remaining.length) {
    const costs = ucsCostsToTargets(graph, current, new Set(remaining), conditions)
    let nearestIndex = -1
    let nearestCost = Infinity
    let nearest: string | undefined
    remaining.forEach((stop, index) => {
      const cost = costs.get(stop) ?? Infinity
      if (cost < nearestCost) {
        nearestCost = cost
        nearestIndex = index
        nearest = stop
      }
    })

    // Keep unreachable stops in the request so the normal leg planner can
    // explain the failure rather than silently dropping requested locations.
    if (nearest === undefined) { order.push(...remaining); break }
    current = nearest
    order.push(current)
    remaining.splice(nearestIndex, 1)
  }
  return order
}

const sharedCache = new WeakMap<Graph, Map<string, unknown>>()

function shared<T>(graph: Graph, key: string, compute: () => T): T {
  let graphCache = sharedCache.get(graph)
  if (!graphCache) {
    graphCache = new Map()
    sharedCache.set(graph, graphCache)
  }
  const hit = graphCache.get(key)
  if (hit !== undefined) return hit as T
  const made = compute()
  graphCache.set(key, made)
  return made
}

function conditionKey(conditions: Conditions) {
  const weights = conditions.weights
  return `${conditions.vehicle}|${conditions.period}|`
    + `${weights.distance},${weights.time},${weights.congestion},${weights.risk}`
}

export interface PlanInput {
  graph: Graph
  algo: AlgoKey
  start: string
  goal: string
  stops: string[]
  optimiseOrder: boolean
  /**
   * The shape of the trip, for every algorithm.
   *
   * False is an open tour running start → stops → goal. True is a closed tour:
   * the trip is described by its locations alone, so `goal` becomes an ordinary
   * stop whose position is chosen like any other, and the route comes home.
   *
   * A plain boolean, not a tri-state. It used to carry a third "omitted" state
   * meaning the older goal-based behaviour, which is what false now means, and
   * which only the two trip-level algorithms read — so four panes could show an
   * open route beside two closed tours with nothing on screen saying why.
   */
  returnToStart: boolean
  conditions: Conditions
}

/** Runs one selected algorithm across every leg of the requested trip. */
export function planRoute(input: PlanInput): RouteResult {
  const { graph, algo, start, goal, stops, optimiseOrder, returnToStart, conditions } = input

  // Held–Karp is a trip-level optimiser that exists only in the Python backend.
  // It needs an exact directed cost matrix over every pair of trip points, which
  // this local planner has no equivalent of, so the honest answer is to state
  // what did not run. Anything else here would be a silent substitution: the
  // pane would show a route the user never asked for, labelled "Held–Karp DP".
  if (algo === 'held_karp') {
    return {
      algo,
      order: [start],
      path: [],
      trace: [],
      reveal: [],
      found: false,
      problem: backendOnlyNote(algo),
      nodeIds: indexer(graph).ids,
      metrics: {
        km: 0, minutes: 0, cost: 0, expanded: 0, ms: 0,
        optimal: false, turnsBlocked: 0,
      },
    }
  }

  const conditionsKey = conditionKey(conditions)
  // Nearest Neighbor chooses the trip order; the legs between its chosen stops
  // are a plain point search, and A* is the one to use. The Python backend
  // routes them with Pairwise A*, so picking anything else here would make the
  // "nodes expanded" figure move when VITE_API_URL is set — the same trip, the
  // same route, the same cost, but a different headline number depending on
  // which planner answered. A* and UCS return the identical route because both
  // are exact; A* just reaches it having opened fewer nodes.
  const pointAlgorithm: PointSearchKey = algo === 'nearest' ? 'astar' : algo
  const heuristicScale = pointAlgorithm === 'astar'
    ? shared(graph, `heuristic:${conditionsKey}`, () => minCostPerKm(graph, conditions))
    : 0
  // One list for both shapes, mirroring `_leg_sequence` and `_plan_nearest` in
  // the backend's planner.py. The dropoff is a destination like any other, and on
  // a round trip the ordering may put it before another stop.
  const destinations = [...stops, goal]
  const shouldOrderDestinations = (algo === 'nearest' || optimiseOrder)
    && destinations.length > 1
  // A closed tour has no last stop, so the dropoff is ordered with everything
  // else. An open route is required to finish at it, so it is held out of the
  // greedy pool and appended — `_greedy_order` in planner.py is the same rule,
  // and a divergence here would mean the same trip planned two ways depending on
  // whether VITE_API_URL happened to be set.
  const pool = returnToStart ? destinations : destinations.filter(node => node !== goal)
  const tail = returnToStart ? [] : [goal]
  const orderedDestinations = shouldOrderDestinations
    ? [
      ...shared(graph, `order:${conditionsKey}|${JSON.stringify([start, pool])}`,
        () => nearestNeighborOrder(graph, start, pool, conditions)),
      ...tail,
    ]
    : destinations
  // Every algorithm reads the flag, point searches included. They do not get to
  // choose the order — that is what the trip-level algorithms are for — but they
  // plan the same shape, so all six panes answer the question the toggle asked.
  const closing = returnToStart ? [start] : []
  const sequence = [start, ...orderedDestinations, ...closing]
    .filter((node, index, all) => index === 0 || node !== all[index - 1])

  if (sequence.length < 2) {
    return {
      algo,
      order: sequence,
      path: [],
      trace: [],
      reveal: [],
      found: false,
      problem: 'The pickup and dropoff pin to the same intersection. Choose points farther apart.',
      nodeIds: indexer(graph).ids,
      metrics: {
        km: 0, minutes: 0, cost: 0, expanded: 0, ms: 0,
        optimal: false, turnsBlocked: 0,
      },
    }
  }

  const trace: TraceStep[] = []
  const reveal: { upto: number; path: string[] }[] = []
  const path: string[] = []
  let km = 0
  let minutes = 0
  let cost = 0
  let ms = 0
  let turnsBlocked = 0
  let found = true
  let problem: string | undefined
  let reached = 1

  for (let index = 0; index + 1 < sequence.length; index++) {
    const legFrom = sequence[index]
    const legTo = sequence[index + 1]
    if (legFrom === undefined || legTo === undefined) break
    const leg = runPointSearch(
      pointAlgorithm,
      graph,
      legFrom,
      legTo,
      conditions,
      heuristicScale,
    )
    ms += leg.ms
    turnsBlocked += leg.turnsBlocked
    trace.push(...leg.trace)

    if (!leg.found) {
      found = false
      problem = whyBlocked(graph, legFrom, legTo, conditions)
      if (sequence.length > 2) {
        problem = `Leg ${index + 1}/${sequence.length - 1} is blocked. ${problem}`
      }
      break
    }

    const stats = statsOf(leg.edges, conditions)
    km += stats.km
    minutes += stats.minutes
    cost += stats.cost
    path.push(...(path.length ? leg.path.slice(1) : leg.path))
    reveal.push({ upto: trace.length, path: [...path] })
    reached = index + 2
  }

  return {
    algo,
    order: sequence.slice(0, reached),
    path,
    trace,
    reveal,
    found,
    problem,
    nodeIds: indexer(graph).ids,
    metrics: {
      km: +km.toFixed(2),
      minutes: Math.round(minutes),
      cost: +cost.toFixed(1),
      expanded: trace.length,
      ms: +ms.toFixed(1),
      turnsBlocked,
      optimal: found
        && ALGOS[algo].optimal
        && stops.length === 0
        && !costIsFlat(conditions.weights),
    },
  }
}

