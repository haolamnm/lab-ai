/**
 * The runtime label describes the run, not the algorithm.
 *
 * The figure it sits on measures a different span depending on which planner
 * answered and on whether the trip had an ordering step, so a label fixed per
 * algorithm is wrong for most of the table. The case that forced this: the
 * backend times its whole post-validation pipeline, which for Nearest Neighbor
 * is a full directed pairwise A* matrix — twenty searches on a three-stop trip,
 * of which only the chosen five appear in `expanded`. Calling that
 * "Algorithm running time" claims the search did a fraction of the work it did.
 */

import { expect, test } from 'bun:test'
import { ordersTheTrip, runtimeNote } from './search'

const local = { remote: false, optimiseOrder: false }
const remote = { remote: true, optimiseOrder: false }

test('a plain point search is timed as the search itself', () => {
  expect(runtimeNote('astar', local)).toBe('Algorithm running time')
  expect(runtimeNote('bfs', local)).toBe('Algorithm running time')
})

test('a remote run is named as backend planning time, ordering or not', () => {
  expect(runtimeNote('astar', remote)).toBe('Complete backend planning time')
})

test('an ordering algorithm on the backend says the ordering is counted', () => {
  expect(runtimeNote('nearest', remote)).toContain('pairwise ordering search')
  expect(runtimeNote('held_karp', remote)).toContain('bitmask DP')
})

test('a point search with optimiseOrder is labelled like an ordering one', () => {
  // The pairwise matrix is built for it too, and it is inside the backend's
  // clock. The label used to ignore the flag entirely.
  expect(runtimeNote('astar', { remote: true, optimiseOrder: true }))
    .toBe(runtimeNote('nearest', remote))
})

test('a local ordering run says the ordering is not counted', () => {
  // The browser sums leg searches and memoises the ordering outside that sum,
  // so the same words as the remote case would be the opposite of the truth.
  const note = 'Running time of the legs alone — the ordering search is not counted'
  expect(runtimeNote('nearest', local)).toBe(note)
  expect(runtimeNote('astar', { remote: false, optimiseOrder: true })).toBe(note)
})

/* `ordersTheTrip` decides two things at once: which words the runtime label
 * gets, and whether CompareAlgos may rank one row's runtime against another's.
 * The table itself needs a DOM to drive, so the predicate under it is what these
 * pin — a wrong answer here marks the algorithm that skipped the pairwise search
 * as the fastest one in the table. */

test('the two trip-level algorithms always order', () => {
  expect(ordersTheTrip('held_karp', false)).toBe(true)
  expect(ordersTheTrip('nearest', false)).toBe(true)
})

test('a point search orders only when asked', () => {
  expect(ordersTheTrip('astar', false)).toBe(false)
  expect(ordersTheTrip('ucs', false)).toBe(false)
  expect(ordersTheTrip('astar', true)).toBe(true)
  expect(ordersTheTrip('bfs', true)).toBe(true)
})

test('optimiseOrder puts every algorithm on one footing', () => {
  // What makes the CompareAlgos runtime column rankable again: with the flag on,
  // no row is missing the pairwise search the others paid for.
  const algos = ['astar', 'ucs', 'bfs', 'dfs', 'nearest', 'held_karp'] as const
  expect(new Set(algos.map(a => ordersTheTrip(a, true))).size).toBe(1)
  // With it off, the table is mixed — which is the case that must not be ranked.
  expect(new Set(algos.map(a => ordersTheTrip(a, false))).size).toBe(2)
})

test('the label agrees with the predicate for every combination', () => {
  const algos = ['astar', 'ucs', 'bfs', 'dfs', 'nearest', 'held_karp'] as const
  for (const optimiseOrder of [false, true]) {
    for (const algo of algos) {
      const note = runtimeNote(algo, { remote: false, optimiseOrder })
      expect(note.includes('not counted')).toBe(ordersTheTrip(algo, optimiseOrder))
    }
  }
})

test('no label claims the ordering is excluded when the backend counted it', () => {
  for (const optimiseOrder of [false, true]) {
    for (const algo of ['astar', 'ucs', 'bfs', 'dfs', 'nearest', 'held_karp'] as const) {
      const note = runtimeNote(algo, { remote: true, optimiseOrder })
      expect(note).not.toContain('not counted')
    }
  }
})
