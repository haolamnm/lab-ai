/**
 * "Roads taken" describes the route the map actually drew.
 *
 * The row is a chain of road names joined with arrows, so every pair of adjacent
 * entries is a claim that the trip turned from one directly onto the other. That
 * claim is only true if no segment is dropped on the way — and on an
 * OpenStreetMap graph, residential ways and alleys frequently carry no `name`
 * tag, so segments to drop are the common case rather than the exotic one.
 */

import { expect, test } from 'bun:test'
import { explain } from './explain'
import { CRITERIA, type Conditions } from './traffic'
import type { Graph, GraphEdge, RouteResult } from './types'

/** A straight chain of one-way roads, named in order. `null` leaves a way unnamed. */
function chain(names: (string | null)[]): Graph {
  const ids = names.map((_, index) => String.fromCharCode(65 + index)).concat(
    String.fromCharCode(65 + names.length),
  )
  const edges: GraphEdge[] = names.map((name, index) => ({
    from: ids[index]!,
    to: ids[index + 1]!,
    km: 1,
    roadClass: 'residential' as const,
    congestion: 1,
    risk: 0,
    shape: [],
    ...(name === null ? {} : { name }),
  }))
  return {
    nodes: Object.fromEntries(
      ids.map((id, index) => [id, { id, lat: 10 + index * 0.001, lng: 106 }]),
    ),
    edges,
    adj: Object.fromEntries(ids.map(id => [id, edges.filter(edge => edge.from === id)])),
    bounds: [[10, 106], [10 + ids.length * 0.001, 106]],
    detail: 'fine',
  }
}

const conditions: Conditions = {
  vehicle: 'bike',
  period: 'peak',
  weights: CRITERIA.balanced.weights,
}

/** The "Roads taken" chain for a route straight down the given chain of ways. */
function roadsTaken(names: (string | null)[]): string[] {
  const graph = chain(names)
  const path = Object.keys(graph.nodes)
  const result: RouteResult = {
    algo: 'astar',
    order: [path[0]!, path.at(-1)!],
    path,
    trace: [],
    nodeIds: path,
    reveal: [],
    found: true,
    metrics: { km: 1, minutes: 1, cost: 1, expanded: 1, ms: 1, optimal: true, turnsBlocked: 0 },
  }
  const info = explain(graph, [{ algo: 'A*', result }], conditions, id => id)
  expect(info).not.toBeNull()
  return info!.streets
}

test('an unnamed way between two stretches of one road is not dropped', () => {
  // The regression this file exists for: skipping the alley made the two Lê Lợi
  // stretches adjacent, and the duplicate-collapse then merged them into a
  // single entry claiming the trip never left that road.
  expect(roadsTaken(['Lê Lợi', null, 'Lê Lợi'])).toEqual([
    'Lê Lợi',
    'Unnamed segment',
    'Lê Lợi',
  ])
})

test('consecutive segments of the same road collapse to one entry', () => {
  expect(roadsTaken(['Lê Lợi', 'Lê Lợi', 'Lê Lợi', 'Nguyễn Huệ'])).toEqual([
    'Lê Lợi',
    'Nguyễn Huệ',
  ])
})

test('consecutive unnamed ways collapse the same way named ones do', () => {
  expect(roadsTaken(['Lê Lợi', null, null, 'Nguyễn Huệ'])).toEqual([
    'Lê Lợi',
    'Unnamed segment',
    'Nguyễn Huệ',
  ])
})

test('a route made entirely of unnamed ways still reports a road', () => {
  // Otherwise the row vanishes while the map plainly shows a multi-segment
  // route, which reads as the explanation having nothing to say about it.
  expect(roadsTaken([null, null])).toEqual(['Unnamed segment'])
})

test('a name that is only whitespace counts as unnamed', () => {
  expect(roadsTaken(['   ', 'Nguyễn Huệ'])).toEqual(['Unnamed segment', 'Nguyễn Huệ'])
})
