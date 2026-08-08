/**
 * The browser planner answers each trip shape the way the Python planner does.
 *
 * Two planners answer the same question here — `planRoute` in the browser, and
 * `plan_route` in `server/src/route_lab/planner.py` when `VITE_API_URL` is set —
 * and the app switches between them on a configuration flag the user never sees.
 * So a divergence is not a wrong answer, it is two answers to one question, and
 * which one you get depends on how the app was deployed. `returnToStart` had
 * exactly that shape: `PlanInput` declared the field, `planClient` forwarded it,
 * the backend acted on it, and the browser silently dropped it on the floor.
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
  // Group 1. Held-Karp is absent by design — it needs a cost matrix this planner
  // has no equivalent of, and says so rather than substituting another route.
  const point = { ...base, stops: [], optimiseOrder: true }

  expect(trip({ ...point, algo: 'bfs' })).toBe('12.4 AJ')
  expect(trip({ ...point, algo: 'dfs' })).toBe('21.8 AJ')
  expect(trip({ ...point, algo: 'ucs' })).toBe('11.4 AJ')
  expect(trip({ ...point, algo: 'astar' })).toBe('11.4 AJ')
  // Nearest Neighbor has nothing to order on a one-leg trip, so it must land on
  // the same route its Pairwise A* legs would have produced alone.
  expect(trip({ ...point, algo: 'nearest' })).toBe('11.4 AJ')

  expect(planRoute({ ...point, algo: 'held_karp' }).found).toBe(false)
})

test('leaving returnToStart unset keeps the goal as the final destination', () => {
  // Group 2, legacy shape: the trip is `[...stops, goal]` and ends at J.
  const input = { ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true }
  expect(trip(input)).toBe('29.5 ACQMJ')
})

test('returnToStart false ends the trip at the last stop, dropping the goal', () => {
  // Group 2, explicit open route. Once the flag is set the trip is described by
  // its stops alone, so J is no longer part of the shape and the route stops at
  // M. This is the backend's rule, mirrored — not an accident of the ordering.
  const input = {
    ...base, algo: 'nearest' as const, stops: STOPS, optimiseOrder: true, returnToStart: false,
  }
  expect(trip(input)).toBe('17.8 ACQM')
})

test('returnToStart true closes the tour back onto the pickup', () => {
  // Group 3. The same four points as the open route above plus the leg home, so
  // it must be the open route's order with A appended — and cost strictly more.
  const input = {
    ...base, goal: 'A', algo: 'nearest' as const, stops: STOPS, optimiseOrder: true,
  }
  expect(trip({ ...input, returnToStart: true })).toBe('26.7 ACQMA')
  // Unset, the same request is the legacy shape, where goal A folds away against
  // the pickup and the tour never returns. That difference is the whole point of
  // the flag being tri-state rather than a boolean defaulting to false.
  expect(trip(input)).toBe('17.8 ACQM')
})

test('a trip with no stops to make is a valid empty round, not a refusal', () => {
  // Under the explicit shape there is no goal to fall back on, so a stopless
  // trip is the round that stays put. Answering "the pickup and dropoff pin to
  // the same intersection" here would be refusing a well-formed request.
  for (const returnToStart of [false, true]) {
    const result = planRoute({
      ...base, algo: 'nearest', stops: [], optimiseOrder: true, returnToStart,
    })
    expect(result.found).toBe(true)
    expect(result.order).toEqual(['A'])
    expect(result.metrics.km).toBe(0)
  }
})

test('point searches ignore returnToStart on every setting', () => {
  // The flag describes a trip-level shape, and only the trip-level algorithms
  // read it — on both planners. A point search that closed the tour would put
  // four panes on a different question from the other two, side by side.
  for (const algo of ['bfs', 'dfs', 'ucs', 'astar'] as const) {
    const input = { ...base, algo, stops: STOPS, optimiseOrder: true }
    const unset = trip(input)
    expect(trip({ ...input, returnToStart: false }), `${algo} false`).toBe(unset)
    expect(trip({ ...input, returnToStart: true }), `${algo} true`).toBe(unset)
  }
})

test('optimising the visit order changes the route on all four point searches', () => {
  // Group 4. The ordering toggle is a teaching control, so its effect has to be
  // visible on every algorithm that offers it — including DFS, where optimising
  // makes the trip *worse*, because the order is chosen by cost and DFS does not
  // follow cost. That row is the one a plausible "optimised is shorter" check
  // would quietly get wrong.
  const optimised: Record<PointSearchKey, string> = {
    bfs: '29.5 ACQMJ', dfs: '54.2 ACQMJ', ucs: '29.5 ACQMJ', astar: '29.5 ACQMJ',
  }
  const typed: Record<PointSearchKey, string> = {
    bfs: '38.5 ACMQJ', dfs: '43.9 ACMQJ', ucs: '36.7 ACMQJ', astar: '36.7 ACMQJ',
  }

  for (const algo of ['bfs', 'dfs', 'ucs', 'astar'] as const) {
    const input = { ...base, algo, stops: STOPS }
    expect(trip({ ...input, optimiseOrder: true }), `${algo} optimised`).toBe(optimised[algo])
    expect(trip({ ...input, optimiseOrder: false }), `${algo} as typed`).toBe(typed[algo])
  }
})

test('nearest neighbor orders the trip whether or not the toggle is on', () => {
  // Ordering is what Nearest Neighbor *is*; the toggle cannot switch it off, or
  // the pane would be labelled with an algorithm that is not running.
  const input = { ...base, algo: 'nearest' as const, stops: STOPS }
  expect(trip({ ...input, optimiseOrder: false })).toBe(trip({ ...input, optimiseOrder: true }))
})
