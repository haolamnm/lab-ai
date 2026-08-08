/**
 * The seven sample cases still produce the routes their write-ups describe.
 *
 * Each case carries an `about` string quoting real figures — "1.2 km", "A* and
 * UCS agree on 11.4 km", "7.2 km, 23 minutes". Those are the app's teaching
 * material: a student reads the blurb, runs the case, and checks the two agree.
 * Nothing kept them agreeing. A change to the cost model, the sample graph, or
 * a search would move the route and leave the prose describing a trip the app
 * no longer produces, and the app would look wrong in the one place it is meant
 * to be authoritative.
 *
 * So the numbers are asserted, not sampled. This is a characterisation test: it
 * is not deriving what the answer should be, it is pinning what it is. When a
 * deliberate change moves one, update the figure here and the `about` line
 * together — that pairing is the point.
 */

import { expect, test } from 'bun:test'
import { planRoute } from './search'
import { buildSampleGraph } from './sampleGraph'
import { SAMPLE_CASES, type SampleCaseKey } from './sampleCases'
import { CRITERIA } from './traffic'

const graph = buildSampleGraph()

/**
 * The figures each case's `about` text quotes, under that case's own conditions.
 *
 * `km` alone pins only the chosen route. `minutes` and `cost` pin the cost model
 * that chose it: a change to the congestion penalty can leave every route
 * identical while making the trip a different length of time, and the write-ups
 * quote times too — "7.2 km, 23 minutes", "6.6 km, 13 minutes".
 */
const EXPECTED: Record<SampleCaseKey, { km: number; minutes: number; cost: number }> = {
  'two-blocks': { km: 1.2, minutes: 4, cost: 6.4 },
  'cross-town': { km: 11.4, minutes: 35, cost: 63.9 },
  'rush-hour': { km: 7.2, minutes: 23, cost: 61.2 },
  'after-dark': { km: 6.6, minutes: 13, cost: 13.2 },
  'alley': { km: 8.9, minutes: 37, cost: 8.9 },
  'truck-curfew': { km: 12.7, minutes: 78, cost: 98.7 },
  'delivery-round': { km: 29.5, minutes: 104, cost: 169.1 },
}

for (const key of Object.keys(SAMPLE_CASES) as SampleCaseKey[]) {
  const scenario = SAMPLE_CASES[key]

  test(`${key} plans the route its write-up describes`, () => {
    const result = planRoute({
      graph,
      algo: 'astar',
      start: scenario.start,
      goal: scenario.goal,
      stops: scenario.stops,
      optimiseOrder: scenario.optimiseOrder,
      conditions: {
        vehicle: scenario.vehicle,
        period: scenario.period,
        weights: CRITERIA[scenario.criterion].weights,
      },
    })

    expect(result.found).toBe(true)
    expect(result.metrics.km, 'km').toBe(EXPECTED[key].km)
    expect(result.metrics.minutes, 'minutes').toBe(EXPECTED[key].minutes)
    expect(result.metrics.cost, 'cost').toBe(EXPECTED[key].cost)
    // A route that reaches the goal has to start and end where it was asked to.
    expect(result.path[0]).toBe(scenario.start)
    expect(result.path[result.path.length - 1]).toBe(scenario.goal)
    // Every case is reachable, so a search that expands nothing has broken.
    expect(result.metrics.expanded).toBeGreaterThan(0)
  })
}

test('A* and UCS agree on every sample case', () => {
  // Both are exact, so they must return the same cost on the same trip. A* may
  // reach it having opened fewer nodes; disagreeing on the cost would mean the
  // heuristic is not admissible and A* is cutting off a cheaper route.
  for (const key of Object.keys(SAMPLE_CASES) as SampleCaseKey[]) {
    const scenario = SAMPLE_CASES[key]
    const input = {
      graph,
      start: scenario.start,
      goal: scenario.goal,
      stops: scenario.stops,
      optimiseOrder: scenario.optimiseOrder,
      conditions: {
        vehicle: scenario.vehicle,
        period: scenario.period,
        weights: CRITERIA[scenario.criterion].weights,
      },
    }

    const astar = planRoute({ ...input, algo: 'astar' })
    const ucs = planRoute({ ...input, algo: 'ucs' })

    expect(astar.metrics.cost, `${key} cost`).toBe(ucs.metrics.cost)
    expect(astar.metrics.km, `${key} km`).toBe(ucs.metrics.km)
    expect(astar.metrics.expanded, `${key} expanded`).toBeLessThanOrEqual(ucs.metrics.expanded)
  }
})

test('the three-stop run matches both figures its write-up quotes', () => {
  // This case exists to show what optimising the visit order buys, and its
  // write-up names the pair: "Optimised it runs 29.5 km; turn 'Optimise visit
  // order' off and the same algorithms follow the order you typed for 36.7 km."
  // Both halves are the lesson, so both are pinned.
  const scenario = SAMPLE_CASES['delivery-round']
  const input = {
    graph,
    algo: 'astar' as const,
    start: scenario.start,
    goal: scenario.goal,
    stops: scenario.stops,
    conditions: {
      vehicle: scenario.vehicle,
      period: scenario.period,
      weights: CRITERIA[scenario.criterion].weights,
    },
  }

  expect(planRoute({ ...input, optimiseOrder: true }).metrics.km).toBe(29.5)
  expect(planRoute({ ...input, optimiseOrder: false }).metrics.km).toBe(36.7)
})
