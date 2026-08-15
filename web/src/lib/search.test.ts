/**
 * The browser planner answers each trip shape the way the Python planner does.
 *
 * Two planners answer the same question here — `planRoute` in the browser, and
 * `plan_route` in `server/src/route_lab/planner.py` when `VITE_API_URL` is set —
 * and the app switches between them on a configuration flag the user never sees.
 * So a divergence is not a wrong answer, it is two answers to one question, and
 * which one you get depends on how the app was deployed.
 *
 * The figures below were taken by running both planners side by side on the
 * sample graph. Nothing here can call the backend — CI has no Python process —
 * so this is a characterisation test: it pins what the browser answers, and the
 * comment on each block records what the backend answered when they were paired.
 * When a deliberate change moves one, re-run both and move them together.
 */

import { expect, test } from 'bun:test'
import {
  nearestNeighborHeuristic,
  nearestNeighborMultiGoalHeuristic,
  planRoute,
  type PlanInput,
} from './search'
import { buildSampleGraph } from './sampleGraph'
import { CRITERIA } from './traffic'
import type { AlgoKey, Graph } from './types'

/** Mirrors `search.ts`'s own private alias, so adding a sixth algorithm makes
 *  the tables below incomplete rather than silently untested. */
type PointSearchKey = Exclude<AlgoKey, 'nearest' | 'held_karp'>

const graph = buildSampleGraph()

/** The `delivery-round` scenario's conditions, which every case below shares. */
const base = {
  graph,
  start: 'A',
  goal: 'J',
  conditions: {
    vehicle: 'bike' as const,
    period: 'peak' as const,
    weights: CRITERIA.balanced.weights,
  },
}

const STOPS = ['C', 'M', 'Q']

/** The route as one comparable string: rounded distance and the visit order. */
function trip(input: PlanInput) {
  const result = planRoute(input)
  expect(result.found, result.problem ?? 'not found').toBe(true)
  return `${result.metrics.km.toFixed(1)} ${result.order.join('')}`
}

test('a point-to-point trip runs on all five browser algorithms', () => {
  // Held-Karp is absent by design — it needs a cost matrix this planner has no
  // equivalent of, and says so rather than substituting another route. On the
  // backend it now plans this shape too, as an open path pinned to finish at J.
  const point = { ...base, stops: [], optimiseOrder: true, returnToStart: false }

  expect(trip({ ...point, algo: 'bfs' })).toBe('13.4 AJ')
  expect(trip({ ...point, algo: 'dfs' })).toBe('22.9 AJ')
  expect(trip({ ...point, algo: 'ucs' })).toBe('12.4 AJ')
  expect(trip({ ...point, algo: 'astar' })).toBe('12.4 AJ')
  // Nearest Neighbor has nothing to order on a one-leg trip, so it must land on
  // the same route its Pairwise A* legs would have produced alone.
  expect(trip({ ...point, algo: 'nearest' })).toBe('12.4 AJ')

  expect(planRoute({ ...point, algo: 'held_karp' }).found).toBe(false)
})

test('an open tour finishes at the dropoff', () => {
  // The dropoff is a destination, not a hint. Setting the flag used to discard it
  // outright, so this trip ended at whichever stop the ordering left last.
  const input = { ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true }
  expect(trip({ ...input, returnToStart: false })).toBe('30.8 ACQMJ')
})

test('an open tour finishes at a dropoff the ordering would rather visit first', () => {
  // C is the cheapest first destination out of A, so an ordering pass free to
  // place the dropoff anywhere opens with it and leaves the trip ending at Q or
  // M. The J case above cannot catch that: there greedy ends at the dropoff by
  // luck, so a planner that never pins it passes anyway.
  const input = {
    ...base, goal: 'C', stops: ['M', 'Q'], optimiseOrder: true, returnToStart: false,
  }

  for (const algo of ['bfs', 'dfs', 'ucs', 'astar', 'nearest'] as const) {
    const result = planRoute({ ...input, algo })
    expect(result.found, `${algo}`).toBe(true)
    expect(result.order[result.order.length - 1], `${algo}`).toBe('C')
  }

  // The same costs closed: a cycle has no last stop, so nothing is pinned and the
  // ordering is free to open with the dropoff. The two shapes must not be ordered
  // by the same rule, which is why the fix cannot simply be "always visit C last".
  expect(planRoute({ ...input, algo: 'nearest', returnToStart: true }).order)
    .toEqual(['A', 'C', 'Q', 'M', 'A'])
})

test('a round trip demotes the dropoff to an ordinary stop and comes home', () => {
  // A cycle has no last stop, so J stops being the endpoint and takes whatever
  // position the ordering gives it. On these stops that happens to be last again,
  // which is why this case is asserted as a set — the C case above is the one
  // that shows the ordering genuinely moving the dropoff off the end.
  const input = {
    ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true, returnToStart: true,
  }
  const result = planRoute(input)

  expect(result.found).toBe(true)
  expect(result.order[0]).toBe('A')
  expect(result.order[result.order.length - 1]).toBe('A')
  // Every location is still visited: the four destinations plus the pickup at
  // each end. Coming home must not cost the trip one of its stops.
  expect(new Set(result.order)).toEqual(new Set(['A', 'C', 'M', 'Q', 'J']))
})

test('a round trip costs more than the open tour it closes', () => {
  const input = { ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true }
  const open = planRoute({ ...input, returnToStart: false })
  const closed = planRoute({ ...input, returnToStart: true })

  expect(closed.metrics.km).toBeGreaterThan(open.metrics.km)
})

test('every algorithm reads the round-trip flag, point searches included', () => {
  // This is the rule that changed. The flag used to be read only by the two
  // trip-level algorithms, so four panes could show an open route beside two
  // closed tours with nothing on screen saying why they disagreed.
  for (const algo of ['bfs', 'dfs', 'ucs', 'astar', 'nearest'] as const) {
    const input = { ...base, algo, stops: STOPS, optimiseOrder: true }
    const open = planRoute({ ...input, returnToStart: false })
    const closed = planRoute({ ...input, returnToStart: true })

    expect(open.order[open.order.length - 1], `${algo} open`).not.toBe('A')
    expect(closed.order[closed.order.length - 1], `${algo} closed`).toBe('A')
  }
})

test('a point search closes the loop without gaining an ordering it should not have', () => {
  // Shape and ordering are independent controls. Closing the loop must not
  // quietly switch the ordering pass on: with it off, the trip still follows the
  // order that was typed, and only the way home is added.
  const input = { ...base, algo: 'astar' as const, stops: STOPS, optimiseOrder: false }

  expect(trip({ ...input, returnToStart: false })).toBe('37.9 ACMQJ')
  expect(planRoute({ ...input, returnToStart: true }).order).toEqual(
    ['A', 'C', 'M', 'Q', 'J', 'A'],
  )
})

test('a trip whose pickup and dropoff are one point is refused, not planned', () => {
  // No stops, and a dropoff already at the pickup. There is nothing to route, and
  // the backend answers with this same sentence for all six algorithms.
  for (const returnToStart of [false, true]) {
    const result = planRoute({
      ...base, goal: 'A', algo: 'nearest', stops: [], optimiseOrder: true, returnToStart,
    })
    expect(result.found).toBe(false)
    expect(result.problem).toContain('same intersection')
  }
})

test('a blocked greedy step still reports the search it ran', () => {
  // A graph with no roads at all, so the very first greedy step fails with two
  // destinations still outstanding. That step really did expand the pickup and
  // build a trace for it, and `ms` counts its search; dropping the leg because
  // it arrived nowhere would leave a run that spent time expanding nothing.
  // `server/tests/test_planner_nearest.py` pins the same shape on the backend.
  const empty: Graph = { ...graph, edges: [], adj: {} }
  for (const node of Object.keys(empty.nodes)) empty.adj[node] = []

  for (const algo of ['nearest', 'ucs'] as const) {
    const result = planRoute({
      ...base, graph: empty, algo, stops: ['C', 'M'], goal: 'J',
      optimiseOrder: true, returnToStart: true,
    })

    expect(result.found, algo).toBe(false)
    expect(result.path, algo).toEqual([])
    expect(result.metrics.expanded, algo).toBeGreaterThanOrEqual(1)
    expect(result.metrics.expanded, algo).toBe(result.trace.length)
  }
})

test('optimising the visit order changes the route on all four point searches', () => {
  // The ordering toggle is a teaching control, so its effect has to be visible on
  // every algorithm that offers it — including DFS, where optimising makes the
  // trip *worse*, because the order is chosen by cost and DFS does not follow
  // cost. That row is the one a plausible "optimised is shorter" check would
  // quietly get wrong.
  const optimised: Record<PointSearchKey, string> = {
    bfs: '30.8 ACQMJ', dfs: '56.0 ACQMJ', ucs: '30.8 ACQMJ', astar: '30.8 ACQMJ',
  }
  const typed: Record<PointSearchKey, string> = {
    bfs: '40.0 ACMQJ', dfs: '45.5 ACMQJ', ucs: '37.9 ACMQJ', astar: '37.9 ACMQJ',
  }

  for (const algo of ['bfs', 'dfs', 'ucs', 'astar'] as const) {
    const input = { ...base, algo, stops: STOPS, returnToStart: false }
    expect(trip({ ...input, optimiseOrder: true }), `${algo} optimised`).toBe(optimised[algo])
    expect(trip({ ...input, optimiseOrder: false }), `${algo} as typed`).toBe(typed[algo])
  }
})

test('nearest neighbor orders the trip whether or not the toggle is on', () => {
  // Ordering is what Nearest Neighbor *is*; the toggle cannot switch it off, or
  // the pane would be labelled with an algorithm that is not running.
  const input = { ...base, algo: 'nearest' as const, stops: STOPS, returnToStart: false }
  expect(trip({ ...input, optimiseOrder: false })).toBe(trip({ ...input, optimiseOrder: true }))
})

test('nearest neighbor exposes a separate h(n) for its internal A* searches', () => {
  const toJ = nearestNeighborHeuristic(graph, 'J', 2)
  const toC = nearestNeighborHeuristic(graph, 'C', 2)
  const toEither = nearestNeighborMultiGoalHeuristic(graph, ['J', 'C'], 2)
  expect(toJ('J')).toBe(0)
  expect(toJ('A')).toBeGreaterThan(0)
  expect(toEither('A')).toBe(Math.min(toJ('A'), toC('A')))
  expect(toEither('J')).toBe(0)
  expect(toEither('C')).toBe(0)
})

test('nearest neighbor multi-goal A* keeps input order for exact cost ties', () => {
  const edgeDefaults = {
    roadClass: 'secondary' as const, congestion: 1, risk: 0, shape: [] as [number, number][],
  }
  const tiedGraph: Graph = {
    nodes: {
      W: { id: 'W', lat: 10, lng: 106 },
      A: { id: 'A', lat: 10, lng: 106.001 },
      B: { id: 'B', lat: 10, lng: 106.002 },
    },
    edges: [
      // A enters the heap first. B must still win because it is first in the
      // requested candidate order and both shortest-path costs equal one.
      { from: 'W', to: 'A', km: 1, wayId: 1, ...edgeDefaults },
      { from: 'W', to: 'B', km: 1, wayId: 2, ...edgeDefaults },
      { from: 'A', to: 'B', km: 1, wayId: 3, ...edgeDefaults },
      { from: 'B', to: 'A', km: 1, wayId: 4, ...edgeDefaults },
      { from: 'A', to: 'W', km: 1, wayId: 5, ...edgeDefaults },
      { from: 'B', to: 'W', km: 1, wayId: 6, ...edgeDefaults },
    ],
    adj: {},
    bounds: [[10, 106], [10, 106.002]],
    detail: 'fine',
  }
  for (const node of Object.keys(tiedGraph.nodes)) tiedGraph.adj[node] = []
  for (const edge of tiedGraph.edges) tiedGraph.adj[edge.from]?.push(edge)

  const result = planRoute({
    graph: tiedGraph,
    algo: 'nearest',
    start: 'W',
    stops: ['B'],
    goal: 'A',
    optimiseOrder: false,
    returnToStart: true,
    conditions: {
      vehicle: 'van', period: 'peak',
      weights: { distance: 1, time: 0, congestion: 0, risk: 0 },
    },
  })

  expect(result.found).toBe(true)
  expect(result.order).toEqual(['W', 'B', 'A', 'W'])
  expect(result.metrics.expanded).toBe(result.trace.length)
})

test('UCS and nearest neighbor preserve turn context across stop boundaries', () => {
  const edgeDefaults = {
    roadClass: 'secondary' as const, congestion: 1, risk: 0, shape: [] as [number, number][],
  }
  const turnGraph: Graph = {
    nodes: {
      S: { id: 'S', lat: 10.000, lng: 106.000 },
      A: { id: 'A', lat: 10.001, lng: 106.001 },
      C: { id: 'C', lat: 10.002, lng: 106.002 },
      B: { id: 'B', lat: 10.003, lng: 106.003 },
      G: { id: 'G', lat: 10.004, lng: 106.004 },
    },
    edges: [
      { from: 'S', to: 'A', km: 1, wayId: 1, ...edgeDefaults },
      { from: 'A', to: 'B', km: 1, wayId: 2, ...edgeDefaults },
      { from: 'A', to: 'C', km: 2, wayId: 3, ...edgeDefaults },
      { from: 'C', to: 'B', km: 1, wayId: 4, ...edgeDefaults },
      { from: 'B', to: 'G', km: 1, wayId: 5, ...edgeDefaults },
    ],
    adj: {},
    bounds: [[10, 106], [10.003, 106.003]],
    detail: 'fine',
    turns: {
      no: { 'A|1|2': [{ kind: 'no_left_turn', hours: [], except: [] }] },
      only: {},
    },
  }
  for (const node of Object.keys(turnGraph.nodes)) turnGraph.adj[node] = []
  for (const edge of turnGraph.edges) turnGraph.adj[edge.from]?.push(edge)

  for (const algo of ['ucs', 'nearest'] as const) {
    const result = planRoute({
      graph: turnGraph,
      algo,
      start: 'S',
      stops: ['A'],
      goal: 'B',
      optimiseOrder: false,
      returnToStart: false,
      conditions: {
        vehicle: 'van', period: 'peak',
        weights: { distance: 1, time: 0, congestion: 0, risk: 0 },
      },
    })
    expect(result.found, algo).toBe(true)
    expect(result.path, algo).toEqual(['S', 'A', 'C', 'B'])
    expect(result.metrics.turnsBlocked, algo).toBeGreaterThanOrEqual(1)
  }

  const orderedUcs = planRoute({
    graph: turnGraph,
    algo: 'ucs',
    start: 'S',
    stops: ['A', 'B', 'C'],
    goal: 'G',
    optimiseOrder: true,
    returnToStart: false,
    conditions: {
      vehicle: 'van', period: 'peak',
      weights: { distance: 1, time: 0, congestion: 0, risk: 0 },
    },
  })
  expect(orderedUcs.found).toBe(true)
  expect(orderedUcs.order).toEqual(['S', 'A', 'C', 'B', 'G'])
  expect(orderedUcs.path).toEqual(['S', 'A', 'C', 'B', 'G'])
})
