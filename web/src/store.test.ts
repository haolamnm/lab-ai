/**
 * The store's rules hold when its actions are driven in sequence.
 *
 * `store.ts` is the largest untested surface in the app: every pane, every
 * anchor and every result passes through it, and none of its invariants are
 * checked by the type system. A pane list that grows past the cap, two panes
 * showing the same algorithm, or a stale result surviving a change of vehicle
 * are all well-typed states that would simply be wrong on screen.
 *
 * These run with no DOM. Zustand's store is reachable outside React through
 * `getState`, so the actions can be called directly and the state read back —
 * which is the whole reason `lib/` is barred from importing React (see
 * CONVENTIONS section 2). Each test resets to a known graph first, because the
 * store is a module-level singleton shared across the file.
 */

import { beforeEach, expect, test } from 'bun:test'
import { ALGOS } from './lib/search'
import type { AlgoKey } from './lib/types'
import { MAX_PANES, useStore } from './store'

beforeEach(() => {
  useStore.setState({ panes: [] })
  useStore.getState().loadSample('cross-town')
})

test('loading a sample applies its conditions along with its graph', () => {
  useStore.getState().loadSample('rush-hour')
  const state = useStore.getState()

  // The scenario owns vehicle, period and criterion, not just the endpoints —
  // "the rush-hour trip by car" is not the same lesson run on a bike.
  expect(state.vehicle).toBe('car')
  expect(state.period).toBe('peak')
  expect(state.sample).toBe(true)
  expect(state.sampleCase).toBe('rush-hour')
  expect(state.graph).not.toBeNull()
  // Both endpoints are pinned to a node the vehicle can actually leave from;
  // an unpinned endpoint makes every route report "unreachable".
  expect(state.start?.nodeId).toBeTruthy()
  expect(state.goal?.nodeId).toBeTruthy()
})

test('panes are handed distinct algorithms and stop at the cap', () => {
  for (let i = 0; i < MAX_PANES + 3; i++) useStore.getState().addPane()

  const algos = useStore.getState().panes.map(p => p.algo)
  expect(algos.length).toBe(MAX_PANES)
  // Two panes on the same algorithm would compare a run against itself.
  expect(new Set(algos).size).toBe(algos.length)
  expect(MAX_PANES).toBe(Object.keys(ALGOS).length)
})

test('removing a pane frees its algorithm for the next one', () => {
  useStore.getState().addPane()
  const first = useStore.getState().panes[0]
  expect(first).toBeDefined()
  const freed = first!.algo

  useStore.getState().removePane(first!.id)
  expect(useStore.getState().panes.length).toBe(0)

  useStore.getState().addPane()
  expect(useStore.getState().panes[0]?.algo).toBe(freed)
})

test('running fills every pane with a result', async () => {
  useStore.getState().addPane()
  useStore.getState().addPane()
  await useStore.getState().run()

  const state = useStore.getState()
  expect(state.panes.every(p => p.result !== null)).toBe(true)
  expect(state.maxStep).toBeGreaterThan(0)
})

test('changing a pane algorithm never leaves the old result under the new label', async () => {
  useStore.getState().addPane()
  await useStore.getState().run()

  const pane = useStore.getState().panes[0]!
  expect(pane.result).not.toBeNull()
  const other: AlgoKey = pane.algo === 'bfs' ? 'dfs' : 'bfs'

  useStore.getState().setPaneAlgo(pane.id, other)
  const updated = useStore.getState().panes.find(p => p.id === pane.id)!

  expect(updated.algo).toBe(other)
  // The pane re-plans on the spot rather than blanking, so the guarantee is not
  // "no result" but "not the previous algorithm's result" — showing BFS's route
  // under a DFS heading is the one thing a comparison tool must never do.
  expect(updated.result?.algo).toBe(other)
})

test('reordering moves a pane without losing or duplicating one', () => {
  useStore.getState().addPane()
  useStore.getState().addPane()
  useStore.getState().addPane()
  const before = useStore.getState().panes.map(p => p.id)

  useStore.getState().reorderPanes(before[0]!, before[2]!)
  const after = useStore.getState().panes.map(p => p.id)

  expect(after.length).toBe(before.length)
  expect(new Set(after)).toEqual(new Set(before))
  expect(after).not.toEqual(before)
})

test('reordering onto an unknown or identical pane is a no-op', () => {
  useStore.getState().addPane()
  useStore.getState().addPane()
  const before = useStore.getState().panes.map(p => p.id)

  useStore.getState().reorderPanes(before[0]!, before[0]!)
  useStore.getState().reorderPanes('pane-does-not-exist', before[0]!)

  expect(useStore.getState().panes.map(p => p.id)).toEqual(before)
})

test('changing the vehicle clears results rather than leaving stale ones', async () => {
  useStore.getState().addPane()
  await useStore.getState().run()
  useStore.setState({ step: 12 })
  expect(useStore.getState().panes[0]!.result).not.toBeNull()

  useStore.getState().setVehicle('truck')
  const state = useStore.getState()

  expect(state.vehicle).toBe('truck')
  // A route computed for a bike, still on screen under "truck", would show a
  // trip through alleys the truck cannot legally use.
  expect(state.panes.every(p => p.result === null)).toBe(true)
  expect(state.step).toBe(0)
})

test('a scenario applies its trip shape along with its conditions', async () => {
  useStore.getState().loadSample('depot-round')
  useStore.getState().addPane()
  await useStore.getState().run()

  const state = useStore.getState()
  expect(state.returnToStart).toBe(true)
  // The shape has to reach the plan, not just the checkbox. A scenario that set
  // the flag in state but planned an open tour would show a route contradicting
  // its own write-up.
  const order = state.panes[0]!.result?.order ?? []
  expect(order[0]).toBe(order[order.length - 1])

  // And it has to come back off again: the seven open cases must not inherit it.
  useStore.getState().loadSample('cross-town')
  expect(useStore.getState().returnToStart).toBe(false)
})

test('toggling the round trip clears results rather than leaving stale ones', async () => {
  useStore.getState().addPane()
  await useStore.getState().run()
  expect(useStore.getState().panes[0]!.result).not.toBeNull()

  useStore.getState().setReturnToStart(true)

  // An open route still on screen under a round trip would be answering the
  // question the user just changed.
  expect(useStore.getState().returnToStart).toBe(true)
  expect(useStore.getState().panes.every(p => p.result === null)).toBe(true)
})

test('the criterion carries its own weights', () => {
  useStore.getState().setCriterion('time')
  const timeWeights = { ...useStore.getState().weights }

  useStore.getState().setCriterion('avoid')
  expect(useStore.getState().weights).not.toEqual(timeWeights)
})
