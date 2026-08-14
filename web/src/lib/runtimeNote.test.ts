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
import { runtimeNote } from './search'

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

test('no label claims the ordering is excluded when the backend counted it', () => {
  for (const optimiseOrder of [false, true]) {
    for (const algo of ['astar', 'ucs', 'bfs', 'dfs', 'nearest', 'held_karp'] as const) {
      const note = runtimeNote(algo, { remote: true, optimiseOrder })
      expect(note).not.toContain('not counted')
    }
  }
})
