import { haversine } from './geo'
import {
  costIsFlat, edgeCost, edgeMinutes, passable, PERIODS, ROAD_LABEL, turnAllowed, VEHICLES,
  vehicleOf,
  type Conditions,
} from './traffic'
import type { AlgoKey, Graph, GraphEdge, RouteResult, TraceStep } from './types'

/** Each algorithm carries its own colour so a pane can be told apart from
 *  the others when the grid holds up to five panes. This colour only ever
 *  appears on a pane's border and title, never drawn on the map, so it
 *  never competes for meaning with the congestion scale or the exploration
 *  footprint. */
export const ALGOS: { key: AlgoKey; name: string; optimal: boolean; note: string; hue: string }[] = [
  { key: 'bfs',      name: 'BFS',               optimal: false, hue: '#b0651c', note: 'Fewest hops, ignores cost' },
  { key: 'dfs',      name: 'DFS',               optimal: false, hue: '#a33b62', note: 'Plunges down one branch, usually a poor route' },
  { key: 'ucs',      name: 'UCS',               optimal: true,  hue: '#1e5fa8', note: 'Optimal, expands evenly in every direction — this is Dijkstra' },
  { key: 'astar',    name: 'A*',                optimal: true,  hue: '#0a736f', note: 'Optimal, expands fewer nodes thanks to the heuristic' },
  { key: 'greedy',   name: 'Greedy Best-First', optimal: false, hue: '#6d4aa8', note: 'Expands very few nodes, no guarantee of the best route' },
]
export const algoOf = (k: AlgoKey) => ALGOS.find(a => a.key === k)!

/* Node-id ↔ index lookup table, built once per road network. */
const indexCache = new WeakMap<Graph, { ids: string[]; of: Record<string, number> }>()
function indexer(graph: Graph) {
  let hit = indexCache.get(graph)
  if (!hit) {
    const ids = Object.keys(graph.nodes)
    const of: Record<string, number> = {}
    ids.forEach((id, i) => (of[id] = i))
    hit = { ids, of }
    indexCache.set(graph, hit)
  }
  return hit
}

/** Binary priority queue with lazy deletion: stale entries are skipped on pop. */
class Heap {
  private a: { id: string; p: number }[] = []
  get size() { return this.a.length }
  push(id: string, p: number) {
    this.a.push({ id, p })
    let i = this.a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.a[parent].p <= this.a[i].p) break
      ;[this.a[parent], this.a[i]] = [this.a[i], this.a[parent]]
      i = parent
    }
  }
  pop() {
    const top = this.a[0]
    const last = this.a.pop()!
    if (this.a.length) {
      this.a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < this.a.length && this.a[l].p < this.a[m].p) m = l
        if (r < this.a.length && this.a[r].p < this.a[m].p) m = r
        if (m === i) break
        ;[this.a[m], this.a[i]] = [this.a[i], this.a[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * The lowest cost per kilometre found anywhere in the road network.
 * Multiplying it by the straight-line distance gives a lower bound on the
 * true cost, so the heuristic never overestimates — using the raw
 * kilometre figure instead would make A* degenerate to nearly UCS and lose
 * its whole point of comparison.
 */
function minCostPerKm(graph: Graph, c: Conditions): number {
  let best = Infinity
  for (const e of graph.edges) {
    if (!passable(e, c.vehicle, c.period)) continue
    const v = edgeCost(e, c) / e.km
    if (v < best) best = v
  }
  return Number.isFinite(best) ? best : 0
}

interface Leg {
  path: string[]
  /** The segments actually traversed, in order — one fewer than `path`. */
  edges: GraphEdge[]
  trace: TraceStep[]
  found: boolean
  ms: number
  /** Number of times a direction had to be abandoned due to a turn restriction sign. */
  turnsBlocked: number
}

function searchLeg(graph: Graph, algo: AlgoKey, start: string, goal: string, c: Conditions, k: number): Leg {
  const t0 = performance.now()
  const { of } = indexer(graph)
  const goalNode = graph.nodes[goal]
  const weighted = algo !== 'bfs' && algo !== 'dfs'
  const h = (id: string) => k * haversine(graph.nodes[id], goalNode)

  /**
   * What the search remembers as "where I am".
   *
   * A turn restriction constrains a *pair* of segments, so the intersection
   * alone is not enough to decide what is legal next — the state has to be
   * (intersection, segment arrived on). Keying on the intersection alone does
   * not merely blur the rules, it loses routes outright: once an intersection
   * is settled by its cheapest arrival, a dearer arrival that *would* be
   * allowed to turn can never be tried, and the leg reports "unreachable"
   * while a perfectly legal route exists.
   *
   * The wider state costs one entry per incoming segment rather than one per
   * intersection, so it is only paid where restrictions actually exist. The
   * sample graph and imported graphs carry none, and keep the plain state —
   * which is also why their measured node counts are unaffected.
   */
  const turnsActive = !!graph.turns
    && (Object.keys(graph.turns.no).length > 0 || Object.keys(graph.turns.only).length > 0)
  const keyOf = (node: string, inEdge: GraphEdge | null) =>
    turnsActive ? `${node}|${inEdge?.wayId ?? ''}` : node

  const startKey = keyOf(start, null)
  /** Which intersection each state sits at. */
  const nodeAt: Record<string, string> = { [startKey]: start }
  const parent: Record<string, string | null> = { [startKey]: null }
  const via: Record<string, GraphEdge | null> = { [startKey]: null }
  let turnsBlocked = 0
  const g: Record<string, number> = { [startKey]: 0 }
  const closed = new Set<string>()
  const open = new Set<string>([startKey])
  const trace: TraceStep[] = []

  const stack: string[] = [startKey]
  const queue: string[] = [startKey]
  const heap = new Heap()
  const priority = (key: string) =>
    algo === 'greedy' ? h(nodeAt[key])
      : algo === 'astar' ? g[key] + h(nodeAt[key])
        : g[key]
  if (weighted) heap.push(startKey, priority(startKey))

  let found = false
  let goalKey: string | null = null
  for (;;) {
    let cur: string | undefined
    if (algo === 'bfs') cur = queue.shift()
    else if (algo === 'dfs') cur = stack.pop()
    else {
      while (heap.size) {
        const top = heap.pop()
        if (!closed.has(top.id)) { cur = top.id; break }
      }
    }
    if (cur === undefined) break
    if (closed.has(cur)) continue
    closed.add(cur)
    open.delete(cur)

    const at = nodeAt[cur]
    trace.push({
      expanded: of[at],
      frontier: [...open].map(key => of[nodeAt[key]]),
      g: +(g[cur] ?? 0).toFixed(3),
      h: algo === 'astar' || algo === 'greedy' ? +h(at).toFixed(3) : null,
      parent: parent[cur] == null ? null : of[nodeAt[parent[cur]!]],
    })
    if (at === goal) { found = true; goalKey = cur; break }

    const inEdge = via[cur] ?? null
    for (const e of graph.adj[at] ?? []) {
      if (!passable(e, c.vehicle, c.period)) continue
      if (inEdge && !turnAllowed(graph.turns, at, inEdge, e, c)) { turnsBlocked++; continue }
      const next = keyOf(e.to, e)
      if (closed.has(next)) continue
      const step = weighted ? edgeCost(e, c) : 1
      const tentative = (g[cur] ?? 0) + step

      if (!weighted) {
        // BFS and DFS must stick to their own traversal tree, not accept a
        // better parent offered by another branch.
        if (next in g) continue
        g[next] = tentative; parent[next] = cur; via[next] = e; nodeAt[next] = e.to
        ;(algo === 'dfs' ? stack : queue).push(next)
        open.add(next)
      } else {
        if (next in g && tentative >= g[next]) continue
        g[next] = tentative; parent[next] = cur; via[next] = e; nodeAt[next] = e.to
        heap.push(next, priority(next)); open.add(next)
      }
    }
  }

  // Rebuild the route from the states themselves, keeping the very edge objects
  // the search traversed. Looking the edges up again by node pair would pick the
  // first match, and two roads can join the same pair of intersections — the
  // reported distance would then belong to a segment the search never took.
  const path: string[] = []
  const edges: GraphEdge[] = []
  // `!= null`, not a truthy test: when there are no turn restrictions the state
  // key *is* the node id, and an imported graph is free to contain a node whose
  // id is the empty string. A truthy test would end the walk one step early and
  // drop that node from the route while its edge stayed in the list.
  for (let cur = goalKey; cur != null; cur = parent[cur]) {
    path.unshift(nodeAt[cur])
    const e = via[cur]
    if (e) edges.unshift(e)
  }
  return { path, edges, trace, found, turnsBlocked, ms: performance.now() - t0 }
}

export function edgeBetween(graph: Graph, a: string, b: string): GraphEdge | undefined {
  return graph.adj[a]?.find(e => e.to === b)
}

/** Whether there is a path from a to b when only segments satisfying `allow` may be used. */
function reaches(graph: Graph, a: string, b: string, allow: (e: GraphEdge) => boolean): boolean {
  const seen = new Set([a])
  const queue = [a]
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]
    if (cur === b) return true
    for (const e of graph.adj[cur] ?? [])
      if (allow(e) && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
  }
  return seen.has(b)
}

/**
 * Why this leg has no route.
 *
 * "Unreachable" on its own tells the user something is broken but not what
 * to do about it. The two causes behind it call for opposite fixes: a
 * disconnected road network needs to be rebuilt, while a vehicle-class ban
 * means the network is fine and the user just needs to switch vehicles.
 * Telling the two cases apart only costs two breadth-first traversals, so
 * it's worth just spelling it out.
 */
function whyBlocked(graph: Graph, from: string, to: string, c: Conditions): string {
  if (!reaches(graph, from, to, () => true)) {
    // A path existing but not usable means one-way streets running the
    // wrong way, not a disconnected network — the two are fixed
    // differently, so they must not be conflated.
    const back: Record<string, string[]> = {}
    for (const e of graph.edges) (back[e.to] ??= []).push(e.from)
    const seen = new Set([from])
    const queue = [from]
    for (let head = 0; head < queue.length; head++) {
      for (const e of graph.adj[queue[head]] ?? []) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
      for (const f of back[queue[head]] ?? []) if (!seen.has(f)) { seen.add(f); queue.push(f) }
    }
    if (seen.has(to))
      return 'The two points are connected, but only by one-way streets running the wrong direction, so travelling forward cannot reach the destination. '
           + 'Click "Rebuild network" at a higher detail level to get more alternate routes.'

    return 'The road network is disconnected between the two points: at this detail level, no road segment links them. '
         + 'Click "Rebuild network" at a different detail level, or choose two points closer together.'
  }

  const me = vehicleOf(c.vehicle)

  // If the same vehicle can get through at a different time period, the
  // culprit is a truck curfew, not the vehicle itself — and the fix is to
  // change the time, not the vehicle.
  const freeAt = PERIODS.filter(p => p.key !== c.period
    && reaches(graph, from, to, e => passable(e, c.vehicle, p.key)))
  if (freeAt.length && me.curfew)
    return `${me.curfew.note}. Every route connecting the two points passes through `
         + `${me.curfew.classes.map(r => ROAD_LABEL[r]).join(' or ')}, so ${me.name.toLowerCase()} cannot get through right now. `
         + `Switch to the ${freeAt.map(p => p.name.toLowerCase()).join(' or ')} period and it will.`

  const others = VEHICLES.filter(v => v.key !== c.vehicle && reaches(graph, from, to, e => passable(e, v.key, c.period)))
  const banned = me.banned.map(r => ROAD_LABEL[r]).join(' and ') || 'a restricted road'

  if (!others.length)
    return `Every route connecting the two points passes through ${banned} — no vehicle in the list can get through. `
         + 'Rebuild the network at a higher detail level to get more minor roads.'

  return `${me.name} cannot get through: every route connecting the two points passes through ${banned}, and ${me.name.toLowerCase()} is banned there. `
       + `Switch to ${others.map(v => v.name.toLowerCase()).join(' or ')} and it will.`
}

function statsOf(edges: GraphEdge[], c: Conditions) {
  let km = 0, minutes = 0, cost = 0
  for (const e of edges) { km += e.km; minutes += edgeMinutes(e, c); cost += edgeCost(e, c) }
  return { km, minutes, cost }
}

/** Orders stops by nearest neighbour, measured by real cost rather than straight-line distance. */
function orderStops(graph: Graph, start: string, stops: string[], c: Conditions, k: number): string[] {
  const cache = new Map<string, number>()
  const costBetween = (a: string, b: string) => {
    const key = `${a}>${b}`
    if (!cache.has(key)) {
      const leg = searchLeg(graph, 'ucs', a, b, c, k)
      cache.set(key, leg.found ? statsOf(leg.edges, c).cost : Infinity)
    }
    return cache.get(key)!
  }
  const left = [...stops], order: string[] = []
  let cur = start
  while (left.length) {
    let bi = 0
    for (let i = 1; i < left.length; i++)
      if (costBetween(cur, left[i]) < costBetween(cur, left[bi])) bi = i
    cur = left[bi]; order.push(cur); left.splice(bi, 1)
  }
  return order
}

/**
 * The two pieces of a plan that do not depend on which algorithm is running.
 *
 * Every open pane plans the same trip and differs only in `algo`, so without
 * this the cheapest-cost-per-km scan and the nearest-neighbour stop ordering —
 * the latter being a full set of UCS searches — were repeated once per pane for
 * an identical answer, up to five times per click of Run.
 *
 * Keyed off the graph object itself, so rebuilding the network drops the whole
 * entry rather than serving a stale ordering.
 */
const sharedCache = new WeakMap<Graph, Map<string, unknown>>()
function shared<T>(graph: Graph, key: string, compute: () => T): T {
  let per = sharedCache.get(graph)
  if (!per) { per = new Map(); sharedCache.set(graph, per) }
  if (!per.has(key)) per.set(key, compute())
  return per.get(key) as T
}

const conditionKey = (c: Conditions) =>
  `${c.vehicle}|${c.period}|${c.weights.distance},${c.weights.time},${c.weights.congestion},${c.weights.risk}`

export interface PlanInput {
  graph: Graph
  algo: AlgoKey
  start: string
  goal: string
  stops: string[]
  optimiseOrder: boolean
  conditions: Conditions
}

/**
 * Runs one algorithm across the whole trip. With several stops, each leg
 * runs in turn and the steps are stitched together into a single timeline,
 * so every pane can be compared against the others on the same timeline bar.
 */
export function planRoute(input: PlanInput): RouteResult {
  const { graph, algo, start, goal, stops, optimiseOrder, conditions } = input
  const ck = conditionKey(conditions)
  const k = shared(graph, `k:${ck}`, () => minCostPerKm(graph, conditions))
  const ordered = optimiseOrder && stops.length > 1
    ? shared(graph, `order:${ck}|${start}|${stops.join(',')}`,
      () => orderStops(graph, start, stops, conditions, k))
    : [...stops]
  const seq = [start, ...ordered, goal].filter((v, i, a) => i === 0 || v !== a[i - 1])

  // Two different addresses can still pin to the same intersection — the
  // two ends of an alley, for instance. When that happens the leg sequence
  // collapses to a single element and the loop below never runs; returning
  // as usual would make the UI show "done at step 0, optimal", which looks
  // exactly like the app has frozen. Better to say so plainly.
  if (seq.length < 2) return {
    algo, order: seq, path: [], trace: [], reveal: [], found: false,
    problem: 'The pickup and dropoff both pin to the same intersection. Choose two points farther apart, or increase the road network detail level.',
    nodeIds: indexer(graph).ids,
    metrics: { km: 0, minutes: 0, cost: 0, expanded: 0, ms: 0, optimal: false, turnsBlocked: 0 },
  }

  const trace: TraceStep[] = []
  const reveal: { upto: number; path: string[] }[] = []
  const path: string[] = []
  let km = 0, minutes = 0, cost = 0, ms = 0, turnsBlocked = 0, found = true
  let problem: string | undefined
  // How far into the trip the route actually reached. Once a leg fails, the
  // stops after it were never visited, and listing them in the visit order
  // would misrepresent what happened.
  let reached = 1

  for (let i = 0; i + 1 < seq.length; i++) {
    const leg = searchLeg(graph, algo, seq[i], seq[i + 1], conditions, k)
    ms += leg.ms
    turnsBlocked += leg.turnsBlocked
    const reachedAt = leg.trace.length
    trace.push(...leg.trace)
    if (!leg.found) {
      found = false
      problem = whyBlocked(graph, seq[i], seq[i + 1], conditions)
      if (seq.length > 2) problem = `Leg ${i + 1}/${seq.length - 1} is blocked. ${problem}`
      break
    }

    const s = statsOf(leg.edges, conditions)
    km += s.km; minutes += s.minutes; cost += s.cost
    path.push(...(path.length ? leg.path.slice(1) : leg.path))
    reveal.push({ upto: trace.length - leg.trace.length + reachedAt, path: [...path] })
    reached = i + 2
  }

  return {
    algo, order: seq.slice(0, reached), path, trace, reveal, found, problem,
    nodeIds: indexer(graph).ids,
    metrics: {
      km: +km.toFixed(2),
      minutes: Math.round(minutes),
      cost: +cost.toFixed(1),
      expanded: trace.length,
      ms: +ms.toFixed(1),
      turnsBlocked,
      // With no route, there is nothing to be optimal about. This used to
      // just read the algorithm's theoretical property, so it stamped
      // "OPTIMAL" on an empty result right next to the "unreachable" line
      // above it.
      //
      // Turn restrictions are deliberately NOT factored in here, even
      // though they do weaken the optimality claim. Measured on the real
      // road network, every run hits at least one turn restriction sign
      // somewhere, so folding it in would turn every result into
      // "approximate" and strip this column of the very thing it exists to
      // say — the ability to tell UCS apart from Greedy. The impact is
      // called out separately in the explanation block, together with the
      // count of blocked turns.
      // With flat weights every route costs 0, so "optimal" is
      // mathematically true but no longer says anything meaningful — stop
      // stamping it.
      optimal: found && algoOf(algo).optimal && stops.length === 0 && !costIsFlat(conditions.weights),
    },
  }
}
