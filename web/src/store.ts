import { create } from 'zustand'
import { boundsOf, haversine } from './lib/geo'
import { areaProblem, buildGraph, DETAIL_LABEL, GraphBuildError, snap } from './lib/overpass'
import { backendEnabled, isRecord, messageOf, planRouteRemote } from './lib/planClient'
import { sampleCaseOf, type SampleCaseKey } from './lib/sampleCases'
import { buildSampleGraph, samplePlace } from './lib/sampleGraph'
import { ALGOS, planRoute } from './lib/search'
import {
  clampCongestion, clampRisk, CRITERIA, passable, ROAD_LABEL, type Conditions,
} from './lib/traffic'
import type {
  AlgoKey, CriterionKey, Detail, Graph, PeriodKey, Place, RoadClass, RouteResult, VehicleKey,
  Weights,
} from './lib/types'

/**
 * Pin a coordinate to the intersection that the given vehicle can actually
 * leave from.
 *
 * This is the single most safety-critical rule in the app, and it is exported
 * precisely so nobody has to restate it: pinning a truck to an alley mouth it
 * cannot legally exit makes every route from that point report "unreachable",
 * and the cause is invisible from the message. With no graph yet there is
 * nothing to pin to, so the anchor carries a null node rather than the caller
 * having to spell out that fallback at each site.
 */
export function anchorTo(
  graph: Graph, place: Place, vehicle: VehicleKey, period: PeriodKey,
): { nodeId: string; metres: number }
export function anchorTo(
  graph: Graph | null, place: Place, vehicle: VehicleKey, period: PeriodKey,
): { nodeId: string | null; metres: number }
export function anchorTo(graph: Graph | null, place: Place, vehicle: VehicleKey, period: PeriodKey) {
  return graph
    ? snap(graph, place, id => (graph.adj[id] ?? []).some(e => passable(e, vehicle, period)))
    : { nodeId: null, metres: 0 }
}

/**
 * Two ways of viewing the same result: laid over the real city, or as the search
 * tree the algorithm actually built.
 *
 * There was a third, "Schematic" — the same map with the basemap tiles taken
 * away and the roads flattened to one neutral tone. It existed to strip the
 * clutter away from the exploration footprint, but it kept every node at its
 * true geographic position, so it answered the same question the map does and
 * only looked quieter doing it. Once the tree view became a readable node-link
 * diagram, that was the view for reading structure, and the schematic sat
 * between the two answering neither.
 */
export type PaneView = 'map' | 'tree'

export interface Pane {
  id: string
  algo: AlgoKey
  view: PaneView
  result: RouteResult | null
}

/** A point the user picked, together with the intersection it is pinned to. */
export interface Anchor {
  place: Place
  nodeId: string | null
  metres: number
}

interface State {
  start: Anchor | null
  goal: Anchor | null
  stops: Anchor[]

  detail: Detail
  graph: Graph | null
  building: boolean
  buildError: string | null
  /** Note shown when the app automatically changes the detail level on the user's behalf. */
  buildNote: string | null

  period: PeriodKey
  vehicle: VehicleKey
  criterion: CriterionKey
  weights: Weights
  optimiseOrder: boolean

  panes: Pane[]
  step: number
  maxStep: number
  playing: boolean
  /** Multiplies the step delay, so a larger number plays back slower. */
  slowdown: number
  syncView: boolean
  /** True while a remote run is in flight, so the Run button can lock like Build does. */
  running: boolean
  /** Message from the last failed remote run. Cleared on the next successful run. */
  runError: string | null

  setPlace: (role: 'start' | 'goal', place: Place | null) => void
  addStop: (place: Place) => void
  removeStop: (i: number) => void

  setDetail: (d: Detail) => void
  build: () => Promise<void>
  /** Loads the sample network and applies one scenario. Defaults to the first. */
  loadSample: (caseKey?: SampleCaseKey) => void
  importGraph: (json: string) => void
  /** True when using the custom-built sample graph rather than OpenStreetMap data. */
  sample: boolean
  /** Which scenario is loaded, or null for an imported graph that matches none. */
  sampleCase: SampleCaseKey | null

  setPeriod: (p: PeriodKey) => void
  setVehicle: (v: VehicleKey) => void
  setCriterion: (c: CriterionKey) => void
  setWeight: (k: keyof Weights, v: number) => void
  setOptimiseOrder: (b: boolean) => void

  addPane: () => void
  removePane: (id: string) => void
  setPaneAlgo: (id: string, algo: AlgoKey) => void
  setPaneView: (id: string, view: PaneView) => void
  reorderPanes: (fromId: string, toId: string) => void

  run: () => Promise<void>
  clearResults: () => void
  setStep: (s: number) => void
  setPlaying: (b: boolean) => void
  setSlowdown: (s: number) => void
  toggleSync: () => void
}

/** One pane per algorithm, so the full set can be on screen at once.
 *
 *  This is a comparison tool, and a cap below the number of things there are to
 *  compare is an arbitrary limit rather than a design. The grid wraps at two
 *  columns and scrolls, so each further pane costs a row, not a layout. */
export const MAX_PANES = Object.keys(ALGOS).length
let seq = 0

export const useStore = create<State>((set, get) => ({
  start: null, goal: null, stops: [],
  detail: 'medium', graph: null, building: false, buildError: null, buildNote: null,
  sample: false, sampleCase: null,
  period: 'peak', vehicle: 'bike', criterion: 'balanced',
  weights: { ...CRITERIA.balanced.weights }, optimiseOrder: false,
  panes: [], step: 0, maxStep: 0, playing: false, slowdown: 1, syncView: true,
  running: false, runError: null,

  setPlace: (role, place) => {
    const { graph, vehicle, period } = get()
    const anchor: Anchor | null = place
      ? { place, ...anchorTo(graph, place, vehicle, period) }
      : null
    set(role === 'start' ? { start: anchor } : { goal: anchor })
    get().clearResults()
  },
  addStop: place => {
    const { graph, vehicle, period } = get()
    const anchor: Anchor = { place, ...anchorTo(graph, place, vehicle, period) }
    set({ stops: [...get().stops, anchor] })
    get().clearResults()
  },
  removeStop: i => {
    set({ stops: get().stops.filter((_, idx) => idx !== i) })
    get().clearResults()
  },

  setDetail: detail => set({ detail }),

  build: async () => {
    const { start, goal, stops } = get()
    if (!start || !goal) return
    set({ building: true, buildError: null, buildNote: null })

    const points = [start.place, ...stops.map(s => s.place), goal.place]
    const asked = get().detail

    // If the network comes back disconnected, the app changes the detail level on the user's
    // behalf, but which direction it moves depends on the trip's length. A long trip needs a
    // coarser level, because the downloaded corridor is wider, wide enough to encompass the
    // whole looping highway. A short trip is the opposite: what's missing is exactly the small
    // road segments that connect the trunk roads to each other.
    const long = haversine(start.place, goal.place) > 25
    // The "Alleys" level is never auto-selected: it is heavy and only suits very short
    // distances, so it has to be the user's own decision.
    const order: Detail[] = long
      ? ['coarse', 'medium', 'fine']
      : ['fine', 'medium', 'coarse']
    const fallbacks = order.filter(d => d !== asked && !areaProblem(points, d))

    let detail = asked
    let note: string | null = null

    try {
      for (;;) {
        try {
          const graph = await buildGraph(points, detail)
          // Re-read the full state right before writing. Building the road network is a network
          // call that runs for several seconds; while it's in flight, the user can still change
          // the pickup point. Writing back the snapshot taken at the top of this function would
          // silently discard their new choice — the time period and vehicle here are already
          // re-read for exactly that reason, it's only the three points that were missed.
          const fresh = get()
          set({
            graph, detail, buildNote: note, sample: false, sampleCase: null, building: false,
            ...reanchorAll(fresh, graph, fresh.vehicle, fresh.period),
          })
          get().clearResults()
          return
        } catch (e) {
          const next = fallbacks.shift()
          if (!(e instanceof GraphBuildError) || !e.needsMoreDetail || !next) throw e
          note = `Level "${DETAIL_LABEL[asked]}" produced a disconnected network, so it was automatically switched to "${DETAIL_LABEL[next]}".`
          detail = next
        }
      }
    } catch (e) {
      set({
        building: false,
        buildError: e instanceof GraphBuildError ? e.message : `Failed to build road network: ${messageOf(e)}`,
      })
    }
  },

  // A scenario is applied as one write, not by calling setVehicle, setPeriod and
  // setCriterion in turn. Each of those re-pins the trip points against whatever
  // is in state at that moment, so applied one at a time they would pin the new
  // vehicle against the old period, and the truck case — the one where pinning
  // actually changes the answer — would land on a node the truck cannot leave.
  loadSample: caseKey => {
    const scenario = sampleCaseOf(caseKey ?? null)
    // The conditions are applied twice over: to the state fields below, and to
    // the pinning, which has to read them from the scenario because the state
    // still holds the ones this very write is replacing.
    const { vehicle, period, criterion, optimiseOrder } = scenario
    const graph = buildSampleGraph()
    const pin = (label: string): Anchor => {
      const place = samplePlace(label)
      return { place, ...anchorTo(graph, place, vehicle, period) }
    }
    set({
      graph, sample: true, sampleCase: scenario.key,
      buildError: null, buildNote: null, building: false,
      start: pin(scenario.start), goal: pin(scenario.goal), stops: scenario.stops.map(pin),
      vehicle, period, criterion, weights: { ...CRITERIA[criterion].weights }, optimiseOrder,
    })
    get().clearResults()
  },

  importGraph: json => {
    try {
      const raw: unknown = JSON.parse(json)
      // An exported file nests the network under `roadNetwork`; a hand-written one
      // is usually just the network on its own, so both shapes are accepted.
      const src = isRecord(raw) && isRecord(raw.roadNetwork) ? raw.roadNetwork : raw
      if (!isRecord(src)) throw new Error('the file is not a JSON object')

      // Nothing in this file is guaranteed — it is authored by whoever wrote it —
      // and two different failures came out of trusting it. A negative congestion
      // value produces a negative edge cost, which breaks the guarantee UCS and A*
      // are built on while both keep stamping "OPTIMAL" on the result. And an edge
      // naming a node the file never defines used to be read straight through to
      // `.lat`, so the user's diagnosis of their own file was a raw TypeError.
      // Everything is checked here, once; past this point it is a real Graph.
      const num = (v: unknown, fallback: number) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : fallback
      }
      const text = (v: unknown) => (typeof v === 'string' ? v : undefined)
      const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

      const nodes: Graph['nodes'] = {}
      for (const n of listOf(src.nodes)) {
        if (!isRecord(n)) continue
        const id = text(n.id)
        const lat = Number(n.lat), lng = Number(n.lng)
        if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
        nodes[id] = { id, lat, lng, label: text(n.label), name: text(n.name) }
      }

      const edges: Graph['edges'] = []
      for (const e of listOf(src.edges)) {
        if (!isRecord(e)) continue
        const from = text(e.from), to = text(e.to)
        const km = Number(e.km)
        const head = from ? nodes[from] : undefined
        const tail = to ? nodes[to] : undefined
        // An edge naming an undefined node has nowhere to start, nowhere to end,
        // and no shape to be drawn along. Dropping it is the only reading of it.
        if (!from || !to || !head || !tail || !Number.isFinite(km)) continue
        const roadClass = text(e.roadClass)
        // A shape that is not a list of coordinate pairs would reach Leaflet and
        // take the whole grid down, so an unusable one falls back to the straight
        // line between the two intersections, exactly as a missing one does.
        const shape = listOf(e.shape).filter((p): p is [number, number] =>
          Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        edges.push({
          from, to, km,
          roadClass: roadClass && roadClass in ROAD_LABEL ? roadClass as RoadClass : 'secondary',
          congestion: clampCongestion(num(e.congestion, 3)),
          risk: clampRisk(num(e.risk, 0.2)),
          name: text(e.name),
          shape: shape.length > 1 ? shape : [[head.lat, head.lng], [tail.lat, tail.lng]],
        })
      }
      if (!Object.keys(nodes).length || !edges.length) throw new Error('no nodes or edges')

      const adj: Graph['adj'] = {}
      for (const id of Object.keys(nodes)) adj[id] = []
      for (const e of edges) adj[e.from]?.push(e)
      const graph: Graph = {
        nodes, edges, adj, detail: 'coarse', bounds: boundsOf(Object.values(nodes)),
      }

      // Re-pin every trip point onto the new graph, exactly as build() and loadSample() do.
      // Skip this step and start.nodeId still points at a node ID from the old graph: BFS, DFS,
      // and UCS silently return "unreachable" because adj[start] is empty, while A*
      // crashes outright — haversine reads .lat off a node that no longer exists.
      const fresh = get()
      set({
        // A hand-built graph, but not one of the scenarios: the trip points and
        // conditions in state belong to whatever was loaded before, and the
        // scenario list must not claim to describe a network it has never seen.
        sample: true, sampleCase: null, buildError: null, graph,
        buildNote: `Loaded graph from file: ${Object.keys(nodes).length} nodes, ${edges.length} edges.`,
        ...reanchorAll(fresh, graph, fresh.vehicle, fresh.period),
      })
      get().clearResults()
    } catch (e) {
      set({ buildError: `Could not read graph file: ${messageOf(e)}` })
    }
  },

  setPeriod: period => {
    // Changing the time period must re-pin, just like changing the vehicle: a truck curfew
    // closes off an entire road class, so a spot a truck could leave from at midday may not be
    // leaveable during peak hours.
    const { graph, vehicle } = get()
    set({ period, ...reanchorAll(get(), graph, vehicle, period) })
    get().clearResults()
  },
  setVehicle: vehicle => {
    // Changing the vehicle must re-pin: a spot a motorbike can stop at is not necessarily one a
    // truck can enter.
    const { graph, period } = get()
    set({ vehicle, ...reanchorAll(get(), graph, vehicle, period) })
    get().clearResults()
  },
  setCriterion: criterion => {
    if (criterion === 'custom') return set({ criterion })
    set({ criterion, weights: { ...CRITERIA[criterion].weights } })
    get().clearResults()
  },
  setWeight: (k, v) => {
    set({ weights: { ...get().weights, [k]: v }, criterion: 'custom' })
    get().clearResults()
  },
  setOptimiseOrder: b => { set({ optimiseOrder: b }); get().clearResults() },

  addPane: () => {
    const { panes } = get()
    if (panes.length >= MAX_PANES) return
    const used = panes.map(p => p.algo)
    // The declaration order of ALGOS is the hand-out order. The cap above is the
    // number of algorithms there are, so with room for a pane there is always one
    // left; this guard only exists because `find` has no way to say so.
    const algo = (Object.keys(ALGOS) as AlgoKey[]).find(a => !used.includes(a))
    if (!algo) return
    const pane: Pane = {
      id: `pane-${++seq}`, algo, view: panes[0]?.view ?? 'map', result: null,
    }
    set({ panes: [...panes, pane] })
    planForPane(set, get, pane.id, algo)
  },
  removePane: id => {
    set({ panes: get().panes.filter(p => p.id !== id) })
    recount(set, get)
  },
  setPaneView: (id, view) => {
    set({ panes: get().panes.map(p => (p.id === id ? { ...p, view } : p)) })
  },
  setPaneAlgo: (id, algo) => {
    set({ panes: get().panes.map(p => (p.id === id ? { ...p, algo, result: null } : p)) })
    planForPane(set, get, id, algo)
  },
  reorderPanes: (fromId, toId) => {
    const panes = [...get().panes]
    const from = panes.findIndex(p => p.id === fromId)
    const to = panes.findIndex(p => p.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = panes.splice(from, 1)
    if (!moved) return
    panes.splice(to, 0, moved)
    set({ panes })
  },

  run: async () => {
    const s = get()
    const input = planInput(s)
    if (!input || !s.panes.length) return

    // Every graph goes to the backend when one is configured, the hand-built sample
    // included. The backend is stateless and is handed the whole graph in the request,
    // so there is nothing about a browser-built graph it cannot plan over, and the
    // sample is twenty nodes — the round trip is not measurable. Excluding it used to
    // mean two panes on one screen could be computed by two different planners, which
    // is a disagreement the user has no way to see the cause of, and it left Held–Karp
    // unable to run on the small graph that demonstrates it best.
    if (backendEnabled) {
      // Snapshot which algorithm each pane asked for. The requests run for a
      // moment, and the user can add, remove, reorder, or re-assign panes while
      // they are in flight; results are merged back by pane id below rather than
      // by array position, so a concurrent edit is never clobbered — the same
      // reason build() re-reads state before writing.
      const jobs = s.panes.map(p => ({ id: p.id, algo: p.algo }))
      set({ running: true, runError: null })
      try {
        // Each job carries its own result rather than being paired back up by
        // array position afterwards, so the pane id and the plan it belongs to
        // can never drift apart.
        const settled = await Promise.all(jobs.map(async j =>
          ({ ...j, result: await planRouteRemote({ ...input, algo: j.algo }) })))
        const done = new Map(settled.map(j => [j.id, j]))
        const panes = get().panes.map(p => {
          const hit = done.get(p.id)
          // Apply only to a pane that still exists and still asks for that algorithm.
          return hit && hit.algo === p.algo ? { ...p, result: hit.result } : p
        })
        const maxStep = Math.max(0, ...panes.map(p => (p.result ? p.result.trace.length : 0)))
        set({ panes, maxStep, step: 0, playing: true, running: false, runError: null })
      } catch (e) {
        set({ running: false, runError: `Could not reach the planning backend: ${messageOf(e)}` })
      }
      return
    }

    const panes = s.panes.map(p => ({ ...p, result: planRoute({ ...input, algo: p.algo }) }))
    const maxStep = Math.max(0, ...panes.map(p => p.result.trace.length))
    set({ panes, maxStep, step: 0, playing: true, runError: null })
  },
  clearResults: () => {
    set({
      panes: get().panes.map(p => ({ ...p, result: null })),
      step: 0, maxStep: 0, playing: false, runError: null,
    })
  },
  setStep: step => set({ step, playing: false }),
  setPlaying: playing => set({ playing }),
  setSlowdown: slowdown => set({ slowdown }),
  toggleSync: () => set({ syncView: !get().syncView }),
}))

/**
 * Plans one pane's route and writes it in by id, or leaves the pane empty if it
 * must not hold one yet.
 *
 * Both ways of changing a single pane — adding one, and switching its algorithm
 * — go through here so a single rule decides when a pane may hold a result.
 * They used to gate differently: `addPane` waited for the timeline to exist and
 * `setPaneAlgo` did not, so picking a different algorithm before ever pressing
 * Run gave that one pane a route and started the shared timeline while every
 * other pane still read "not run" — exactly the split state the gate exists to
 * prevent.
 *
 * When a backend is configured it plans through the same remote path `run()`
 * uses, so a pane added or re-assigned after a run is computed by the backend
 * exactly like its siblings, never silently by the local planner. The write is
 * gated on the pane still existing with the same algorithm, since a remote plan
 * can resolve after the user has moved on.
 *
 * `run()` deliberately does not come through here: it plans every pane and
 * resets the timeline to step 0, which is a different contract.
 */
function planForPane(
  set: (p: Partial<State>) => void, get: () => State, id: string, algo: AlgoKey,
): void {
  const s = get()
  if (s.maxStep === 0) { recount(set, get); return }
  const input = planInput(s)
  if (!input) { recount(set, get); return }

  const write = (result: RouteResult) => {
    set({ panes: get().panes.map(p => (p.id === id && p.algo === algo ? { ...p, result } : p)) })
    recount(set, get)
  }

  if (backendEnabled) {
    planRouteRemote({ ...input, algo })
      .then(write)
      .catch((e: unknown) =>
        set({ runError: `Could not reach the planning backend: ${messageOf(e)}` }))
    return
  }
  write(planRoute({ ...input, algo }))
}

/**
 * The algorithm the comparison tables hold fixed.
 *
 * Each table varies one axis and freezes the rest, so it needs one algorithm to
 * freeze, and the leftmost pane is the choice a user can predict without being
 * told — it is already the pane the view sync realigns everyone to. Stated here
 * once because two tables were each spelling out both the rule and its fallback.
 * With no panes open there is nothing to read, so the algorithm the grid hands
 * out first stands in.
 */
export const leadAlgo = (s: State): AlgoKey => s.panes[0]?.algo ?? 'astar'

/** Bundles everything a run needs, or null if the conditions to run haven't been met yet. */
function planInput(s: State): Omit<Parameters<typeof planRoute>[0], 'algo'> | null {
  if (!s.graph || !s.start?.nodeId || !s.goal?.nodeId) return null
  const conditions: Conditions = { vehicle: s.vehicle, period: s.period, weights: s.weights }
  return {
    graph: s.graph,
    start: s.start.nodeId,
    goal: s.goal.nodeId,
    stops: s.stops.map(x => x.nodeId).filter((x): x is string => !!x),
    optimiseOrder: s.optimiseOrder,
    conditions,
  }
}

/**
 * Re-pins every trip point — pickup, dropoff, and each stop — onto the current
 * road network.
 *
 * Changing the vehicle, changing the time period, and rebuilding the network all need exactly
 * this one operation, and those three call sites used to hand-copy three identical versions of
 * it — fixing one copy and forgetting the other two is the quietest way to break this, because
 * the result still runs, it just pins to the wrong place.
 */
function reanchorAll(
  // Only the trip points matter here. Taking the whole State would invite a
  // future call site to read `s.graph` instead of the `graph` argument — and
  // build() and importGraph() both call this before the new graph is in state,
  // so that reading would silently pin against the graph being replaced.
  s: Pick<State, 'start' | 'goal' | 'stops'>,
  graph: Graph | null, vehicle: VehicleKey, period: PeriodKey,
) {
  // Takes and returns a real Anchor, because a stop is never null. The pickup and
  // dropoff are, so they test for themselves rather than making every stop pass
  // through a nullable signature it would then have to assert its way back out of.
  const re = (a: Anchor): Anchor =>
    (graph ? { ...a, ...anchorTo(graph, a.place, vehicle, period) } : a)
  return {
    start: s.start && re(s.start),
    goal: s.goal && re(s.goal),
    stops: s.stops.map(re),
  }
}

function recount(set: (p: Partial<State>) => void, get: () => State) {
  const maxStep = Math.max(0, ...get().panes.map(p => (p.result ? p.result.trace.length : 0)))
  set({ maxStep, step: Math.min(get().step, maxStep) })
}
