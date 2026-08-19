import { beforeEach, expect, test } from 'bun:test'
import { toExportable } from './lib/explain'
import { planRoute } from './lib/search'
import type { Conditions } from './lib/traffic'
import type { Graph } from './lib/types'
import { useStore } from './store'

const conditions: Conditions = {
  vehicle: 'car',
  period: 'peak',
  weights: { distance: 1, time: 0, congestion: 0, risk: 0 },
}

function rawGraph(km: number) {
  return {
    nodes: [
      { id: 'S', lat: 10, lng: 106 },
      { id: 'G', lat: 10, lng: 106.001 },
    ],
    edges: [
      { from: 'S', to: 'G', km, roadClass: 'secondary', congestion: 1, risk: 0 },
    ],
  }
}

function importSuccessfully(value: unknown): Graph {
  useStore.getState().importGraph(JSON.stringify(value))
  const state = useStore.getState()
  expect(state.buildError).toBeNull()
  expect(state.graph).not.toBeNull()
  return state.graph!
}

function restrictedGraph(): Graph {
  const edgeDefaults = {
    roadClass: 'secondary' as const,
    congestion: 1,
    risk: 0,
    shape: [] as [number, number][],
  }
  const graph: Graph = {
    nodes: {
      A: { id: 'A', lat: 10, lng: 106 },
      B: { id: 'B', lat: 10, lng: 106.001 },
      C: { id: 'C', lat: 10, lng: 106.002 },
      D: { id: 'D', lat: 10.001, lng: 106.001 },
    },
    edges: [
      { from: 'A', to: 'B', km: 1, wayId: 10, ...edgeDefaults },
      { from: 'B', to: 'C', km: 1, wayId: 20, ...edgeDefaults },
      { from: 'B', to: 'D', km: 2, wayId: 30, ...edgeDefaults },
      { from: 'D', to: 'C', km: 2, wayId: 40, ...edgeDefaults },
    ],
    adj: {},
    bounds: [[10, 106], [10.001, 106.002]],
    detail: 'fine',
    turns: {
      no: {
        'B|10|20': [{ kind: 'no_left_turn', hours: [], except: [] }],
      },
      only: {
        'B|10': [{
          kind: 'only_right_turn',
          hours: [[360, 540]],
          except: ['motorcycle', 'bicycle'],
          onlyTo: 30,
        }],
      },
    },
  }
  for (const id of Object.keys(graph.nodes)) graph.adj[id] = []
  for (const edge of graph.edges) graph.adj[edge.from]?.push(edge)
  return graph
}

beforeEach(() => {
  useStore.getState().loadSample('cross-town')
})

test('graph import rejects a negative km without replacing the current graph', () => {
  const previous = useStore.getState().graph

  useStore.getState().importGraph(JSON.stringify(rawGraph(-1)))

  expect(useStore.getState().buildError).toContain('finite km greater than 0')
  expect(useStore.getState().graph).toBe(previous)
})

test('graph import rejects a zero km without replacing the current graph', () => {
  const previous = useStore.getState().graph

  useStore.getState().importGraph(JSON.stringify(rawGraph(0)))

  expect(useStore.getState().buildError).toContain('finite km greater than 0')
  expect(useStore.getState().graph).toBe(previous)
})

test('graph import still accepts a positive finite km', () => {
  const graph = importSuccessfully(rawGraph(1.25))

  expect(graph.edges).toHaveLength(1)
  expect(graph.edges[0]?.km).toBe(1.25)
})

test('old roadNetwork exports without turn data remain importable', () => {
  const graph = importSuccessfully({
    roadNetwork: rawGraph(1),
    results: [],
  })

  expect(graph.edges[0]?.wayId).toBeUndefined()
  expect(graph.turns).toBeUndefined()
})

test('export and import preserve way ids and complete turn-rule metadata', () => {
  const original = restrictedGraph()
  const exported = toExportable(original, [], conditions, false)
  const imported = importSuccessfully(exported)

  expect(imported.edges.map(edge => edge.wayId)).toEqual([10, 20, 30, 40])
  expect(imported.turns?.no).toEqual(original.turns?.no)
  expect(imported.turns?.only).toEqual(original.turns?.only)
  expect(imported.turns?.only['B|10']?.[0]).toEqual({
    kind: 'only_right_turn',
    hours: [[360, 540]],
    except: ['motorcycle', 'bicycle'],
    onlyTo: 30,
  })

  exported.roadNetwork.turns!.only['B|10']![0]!.except.push('bus')
  expect(original.turns?.only['B|10']?.[0]?.except).toEqual(['motorcycle', 'bicycle'])
})

test('a forbidden turn remains forbidden after export and import', () => {
  const original = restrictedGraph()
  const exported = toExportable(original, [], conditions, false)
  const imported = importSuccessfully(exported)
  const route = (graph: Graph) => planRoute({
    graph,
    algo: 'ucs',
    start: 'A',
    goal: 'C',
    stops: [],
    optimiseOrder: false,
    returnToStart: false,
    conditions,
  })

  const before = route(original)
  const after = route(imported)

  expect(before.path).toEqual(['A', 'B', 'D', 'C'])
  expect(after.path).toEqual(before.path)
  expect(after.metrics.turnsBlocked).toBeGreaterThanOrEqual(1)
})
