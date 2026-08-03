import { haversine } from './geo'
import {
  costIsFlat, edgeCost, edgeMinutes, passable, PERIODS, ROAD_LABEL, turnAllowed, VEHICLES,
  vehicleOf,
  type Conditions,
} from './traffic'
import type { AlgoKey, Graph, GraphEdge, RouteResult, TraceStep } from './types'

export interface AlgorithmInfo {
  key: AlgoKey
  name: string
  optimal: boolean
  note: string
  hue: string
}

/** Metadata used by the pane selector and result explanation. */
export const ALGOS: AlgorithmInfo[] = [
  { key: 'bfs', name: 'BFS', optimal: false, hue: '#b0651c', note: 'Fewest hops, ignores cost' },
  { key: 'dfs', name: 'DFS', optimal: false, hue: '#a33b62', note: 'Plunges down one branch, usually a poor route' },
  { key: 'ucs', name: 'UCS', optimal: true, hue: '#1e5fa8', note: 'Optimal; this is Dijkstra search' },
  { key: 'astar', name: 'A*', optimal: true, hue: '#0a736f', note: 'Optimal, guided by a lower-bound heuristic' },
  { key: 'greedy', name: 'Greedy Best-First', optimal: false, hue: '#6d4aa8', note: 'Guided only by the heuristic; not optimal' },
  { key: 'nearest', name: 'Nearest Neighbor', optimal: false, hue: '#527326', note: 'Orders stops greedily by UCS route cost; each leg uses UCS' },
  { key: 'held_karp', name: 'Held–Karp DP', optimal: true, hue: '#b45309', note: 'Exact cheapest closed tour, from Pairwise A* costs and bitmask DP. Backend only' },
]

export function algoOf(key: AlgoKey): AlgorithmInfo {
  return ALGOS.find(algorithm => algorithm.key === key)!
}

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

  push(id: string, priority: number, cost: number) {
    this.entries.push({ id, priority, cost })
    let index = this.entries.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.entries[parent].priority <= this.entries[index].priority) break
      ;[this.entries[parent], this.entries[index]] = [this.entries[index], this.entries[parent]]
      index = parent
    }
  }

  pop(): HeapEntry {
    const first = this.entries[0]
    const last = this.entries.pop()!
    if (!this.entries.length) return first

    this.entries[0] = last
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < this.entries.length
        && this.entries[left].priority < this.entries[smallest].priority) smallest = left
      if (right < this.entries.length
        && this.entries[right].priority < this.entries[smallest].priority) smallest = right
      if (smallest === index) break
      ;[this.entries[smallest], this.entries[index]] = [this.entries[index], this.entries[smallest]]
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

export interface SearchLegResult {
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
  const at = memory.nodeAt[current]
  const parent = memory.parent[current]
  memory.trace.push({
    expanded: memory.nodeIndex[at],
    frontier: [...memory.open].map(key => memory.nodeIndex[memory.nodeAt[key]]),
    g: +memory.cost[current].toFixed(3),
    h: heuristic == null ? null : +heuristic.toFixed(3),
    parent: parent == null ? null : memory.nodeIndex[memory.nodeAt[parent]],
  })
}

function popFresh(frontier: Heap, memory: SearchMemory): string | undefined {
  while (frontier.size) {
    const entry = frontier.pop()
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
  for (let current = goalKey; current != null; current = memory.parent[current]) {
    path.unshift(memory.nodeAt[current])
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
export function breadthFirstSearch(
  graph: Graph, start: string, goal: string, conditions: Conditions,
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const queue = [memory.startKey]
  let head = 0

  while (head < queue.length) {
    const current = queue[head++]
    if (memory.closed.has(current)) continue
    recordExpansion(memory, current)
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      if (key in memory.cost) continue
      remember(memory, key, current, edge, memory.cost[current] + 1)
      queue.push(key)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** Depth-First Search: a LIFO stack explores the newest branch first. */
export function depthFirstSearch(
  graph: Graph, start: string, goal: string, conditions: Conditions,
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const stack = [memory.startKey]

  while (stack.length) {
    const current = stack.pop()!
    if (memory.closed.has(current)) continue
    recordExpansion(memory, current)
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      if (key in memory.cost) continue
      remember(memory, key, current, edge, memory.cost[current] + 1)
      stack.push(key)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** Uniform Cost Search: Dijkstra priority `g(n)` returns a minimum-cost path. */
export function uniformCostSearch(
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
      const candidate = memory.cost[current] + edgeCost(edge, conditions)
      if (key in memory.cost && candidate >= memory.cost[key]) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, candidate, candidate)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** A* Search: priority `g(n) + h(n)` keeps UCS optimality with less exploration. */
export function aStarSearch(
  graph: Graph,
  start: string,
  goal: string,
  conditions: Conditions,
  heuristicScale = minCostPerKm(graph, conditions),
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const estimate = (key: string) =>
    heuristicScale * haversine(graph.nodes[memory.nodeAt[key]], graph.nodes[goal])
  const frontier = new Heap()
  frontier.push(memory.startKey, estimate(memory.startKey), 0)

  for (let current = popFresh(frontier, memory); current !== undefined;
    current = popFresh(frontier, memory)) {
    recordExpansion(memory, current, estimate(current))
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = memory.cost[current] + edgeCost(edge, conditions)
      if (key in memory.cost && candidate >= memory.cost[key]) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, candidate + estimate(key), candidate)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/** Greedy Best-First Search: priority `h(n)` trades optimality for focus. */
export function greedyBestFirstSearch(
  graph: Graph,
  start: string,
  goal: string,
  conditions: Conditions,
  heuristicScale = minCostPerKm(graph, conditions),
): SearchLegResult {
  const startedAt = performance.now()
  const memory = createSearchMemory(graph, start, conditions)
  const estimate = (key: string) =>
    heuristicScale * haversine(graph.nodes[memory.nodeAt[key]], graph.nodes[goal])
  const frontier = new Heap()
  frontier.push(memory.startKey, estimate(memory.startKey), 0)

  for (let current = popFresh(frontier, memory); current !== undefined;
    current = popFresh(frontier, memory)) {
    recordExpansion(memory, current, estimate(current))
    if (memory.nodeAt[current] === goal) return completeLeg(memory, current, startedAt)

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = memory.cost[current] + edgeCost(edge, conditions)
      if (key in memory.cost && candidate >= memory.cost[key]) continue
      remember(memory, key, current, edge, candidate)
      frontier.push(key, estimate(key), candidate)
    }
  }
  return completeLeg(memory, null, startedAt)
}

/**
 * The algorithms that route a single leg.
 *
 * Two keys are excluded because neither is a point-to-point search: `nearest`
 * only chooses a stop order and leaves the routing to UCS, and `held_karp` only
 * chooses a closed tour and leaves the routing to A*. Keeping them out of the
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
    case 'greedy': return greedyBestFirstSearch(graph, start, goal, conditions, heuristicScale)
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
      for (const edge of graph.adj[queue[head]] ?? []) {
        if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to) }
      }
      for (const previous of reverse[queue[head]] ?? []) {
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

  const vehicle = vehicleOf(conditions.vehicle)
  const availablePeriods = PERIODS.filter(period => period.key !== conditions.period
    && reaches(graph, from, to, edge => passable(edge, conditions.vehicle, period.key)))
  if (availablePeriods.length && vehicle.curfew) {
    return `${vehicle.curfew.note}. Switch to the `
      + `${availablePeriods.map(period => period.name.toLowerCase()).join(' or ')} period.`
  }

  const otherVehicles = VEHICLES.filter(candidate => candidate.key !== conditions.vehicle
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
    if (targets.has(at) && !result.has(at)) result.set(at, memory.cost[current])
    if (result.size === targets.size) break

    for (const { edge, key } of nextStates(memory, current)) {
      const candidate = memory.cost[current] + edgeCost(edge, conditions)
      if (key in memory.cost && candidate >= memory.cost[key]) continue
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
export function nearestNeighborOrder(
  graph: Graph, start: string, stops: string[], conditions: Conditions,
): string[] {
  const remaining = [...stops]
  const order: string[] = []
  let current = start

  while (remaining.length) {
    const costs = ucsCostsToTargets(graph, current, new Set(remaining), conditions)
    let nearestIndex = -1
    let nearestCost = Infinity
    for (let index = 0; index < remaining.length; index++) {
      const cost = costs.get(remaining[index]) ?? Infinity
      if (cost < nearestCost) {
        nearestCost = cost
        nearestIndex = index
      }
    }

    // Keep unreachable stops in the request so the normal leg planner can
    // explain the failure rather than silently dropping requested locations.
    if (nearestIndex < 0) { order.push(...remaining); break }
    current = remaining[nearestIndex]
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
  if (!graphCache.has(key)) graphCache.set(key, compute())
  return graphCache.get(key) as T
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
  conditions: Conditions
}

/** Runs one selected algorithm across every leg of the requested trip. */
export function planRoute(input: PlanInput): RouteResult {
  const { graph, algo, start, goal, stops, optimiseOrder, conditions } = input

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
      problem: 'Held–Karp requires the Python planning backend, and none is configured. Set VITE_API_URL, start the server in server/, then reload.',
      nodeIds: indexer(graph).ids,
      metrics: {
        km: 0, minutes: 0, cost: 0, expanded: 0, ms: 0,
        optimal: false, turnsBlocked: 0,
      },
    }
  }

  const conditionsKey = conditionKey(conditions)
  const heuristicScale = algo === 'astar' || algo === 'greedy'
    ? shared(graph, `heuristic:${conditionsKey}`, () => minCostPerKm(graph, conditions))
    : 0
  const shouldOrderStops = (algo === 'nearest' || optimiseOrder) && stops.length > 1
  const orderedStops = shouldOrderStops
    ? shared(graph, `order:${conditionsKey}|${JSON.stringify([start, stops])}`,
      () => nearestNeighborOrder(graph, start, stops, conditions))
    : [...stops]
  const sequence = [start, ...orderedStops, goal]
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

  // Nearest Neighbor chooses the trip order. UCS supplies each exact route
  // between its selected stops and produces the trace shown in its pane.
  const pointAlgorithm: PointSearchKey = algo === 'nearest' ? 'ucs' : algo
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
    const leg = runPointSearch(
      pointAlgorithm,
      graph,
      sequence[index],
      sequence[index + 1],
      conditions,
      heuristicScale,
    )
    ms += leg.ms
    turnsBlocked += leg.turnsBlocked
    trace.push(...leg.trace)

    if (!leg.found) {
      found = false
      problem = whyBlocked(graph, sequence[index], sequence[index + 1], conditions)
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
        && algoOf(algo).optimal
        && stops.length === 0
        && !costIsFlat(conditions.weights),
    },
  }
}

/** Runs the selectable Nearest Neighbor trip algorithm directly. */
export function nearestNeighborSearch(
  input: Omit<PlanInput, 'algo' | 'optimiseOrder'>,
): RouteResult {
  return planRoute({ ...input, algo: 'nearest', optimiseOrder: true })
}
