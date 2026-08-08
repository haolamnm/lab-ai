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
import { planRoute, type PlanInput } from './search'
import { buildSampleGraph } from './sampleGraph'
import { CRITERIA } from './traffic'
import type { AlgoKey } from './types'

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

  expect(trip({ ...point, algo: 'bfs' })).toBe('12.4 AJ')
  expect(trip({ ...point, algo: 'dfs' })).toBe('21.8 AJ')
  expect(trip({ ...point, algo: 'ucs' })).toBe('11.4 AJ')
  expect(trip({ ...point, algo: 'astar' })).toBe('11.4 AJ')
  // Nearest Neighbor has nothing to order on a one-leg trip, so it must land on
  // the same route its Pairwise A* legs would have produced alone.
  expect(trip({ ...point, algo: 'nearest' })).toBe('11.4 AJ')

  expect(planRoute({ ...point, algo: 'held_karp' }).found).toBe(false)
})

test('an open tour finishes at the dropoff', () => {
  // The dropoff is a destination, not a hint. Setting the flag used to discard it
  // outright, so this trip ended at whichever stop the ordering left last.
  const input = { ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true }
  expect(trip({ ...input, returnToStart: false })).toBe('29.5 ACQMJ')
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

  expect(trip({ ...input, returnToStart: false })).toBe('36.7 ACMQJ')
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

test('optimising the visit order changes the route on all four point searches', () => {
  // The ordering toggle is a teaching control, so its effect has to be visible on
  // every algorithm that offers it — including DFS, where optimising makes the
  // trip *worse*, because the order is chosen by cost and DFS does not follow
  // cost. That row is the one a plausible "optimised is shorter" check would
  // quietly get wrong.
  const optimised: Record<PointSearchKey, string> = {
    bfs: '29.5 ACQMJ', dfs: '54.2 ACQMJ', ucs: '29.5 ACQMJ', astar: '29.5 ACQMJ',
  }
  const typed: Record<PointSearchKey, string> = {
    bfs: '38.5 ACMQJ', dfs: '43.9 ACMQJ', ucs: '36.7 ACMQJ', astar: '36.7 ACMQJ',
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
