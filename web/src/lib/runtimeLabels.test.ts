/**
 * The two runtime figures, and which of them may be compared.
 *
 * `ms` is the leg-search sum. Both planners compute it — `planRoute` here and
 * `_route_from_legs` in server/src/route_lab/planner.py — so one trip reports
 * one number whichever answered, and it takes one fixed description.
 *
 * `planningMs` is the backend's whole pipeline. Its span genuinely varies by
 * run, because the ordering search is inside it and not every run orders. That
 * is why it is described per row and never ranked: a row that skipped the
 * pairwise search would otherwise be marked the fastest for skipping it.
 */

import { expect, test } from 'bun:test'
import { ordersTheTrip, planningNote, RUNTIME_NOTE } from './search'

const ALL = ['astar', 'ucs', 'bfs', 'dfs', 'nearest', 'held_karp'] as const

test('the search-runtime figure names both greedy search strategies explicitly', () => {
  // It reads the same for every run because it measures the same thing in every
  // run — that is the whole reason `planningMs` exists as a separate field.
  expect(RUNTIME_NOTE).toContain('multi-goal A*')
  expect(RUNTIME_NOTE).toContain('candidate-based ordering')
  expect(RUNTIME_NOTE).toContain('same boundary')
})

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
  expect(new Set(ALL.map(a => ordersTheTrip(a, true))).size).toBe(1)
  // With it off the table is mixed, which is the case Planning must not rank.
  expect(new Set(ALL.map(a => ordersTheTrip(a, false))).size).toBe(2)
})

test('the planning label says whether the ordering search is in the figure', () => {
  expect(planningNote('nearest', false)).toContain('multi-goal A*')
  expect(planningNote('ucs', true)).toContain('candidate UCS')
  expect(planningNote('held_karp', false)).toContain('bitmask DP')
  expect(planningNote('astar', false)).toContain('no ordering step')
  // The flag alone moves a point search from one description to the other.
  expect(planningNote('astar', true)).toContain('pairwise ordering search')
})

test('the planning label agrees with the predicate for every combination', () => {
  for (const optimiseOrder of [false, true]) {
    for (const algo of ALL) {
      const note = planningNote(algo, optimiseOrder)
      expect(note.includes('no ordering step')).toBe(!ordersTheTrip(algo, optimiseOrder))
    }
  }
})

test('every planning label names the span it covers as the whole backend run', () => {
  for (const optimiseOrder of [false, true]) {
    for (const algo of ALL) {
      expect(planningNote(algo, optimiseOrder)).toContain('Complete backend planning time')
    }
  }
})
