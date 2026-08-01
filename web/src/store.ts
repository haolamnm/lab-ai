import { create } from 'zustand'
import { haversine } from './lib/geo'
import { areaProblem, buildGraph, DETAIL_LABEL, GraphBuildError, snap } from './lib/overpass'
import { buildSampleGraph, SAMPLE_GOAL, SAMPLE_START, samplePlace } from './lib/sampleGraph'
import { planRoute } from './lib/search'
import { CRITERIA, passable, type Conditions } from './lib/traffic'
import type {
  AlgoKey, CriterionKey, Detail, Graph, PeriodKey, Place, RouteResult, VehicleKey, Weights,
} from './lib/types'

/** Ghim một toạ độ vào nút giao mà loại xe đang chọn thật sự rời đi được. */
const anchorTo = (graph: Graph, place: Place, vehicle: VehicleKey, period: PeriodKey) =>
  snap(graph, place, id => (graph.adj[id] ?? []).some(e => passable(e, vehicle, period)))

/** Hai cách nhìn cùng một kết quả: đặt lên bản đồ thật, hoặc bóc ra thành sơ đồ. */
export type PaneView = 'map' | 'graph' | 'tree'

export interface Pane {
  id: string
  algo: AlgoKey
  view: PaneView
  result: RouteResult | null
}

/** Điểm người dùng chọn, cùng nút giao mà nó được ghim vào. */
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
  /** Ghi chú khi ứng dụng tự đổi mức chi tiết giúp người dùng. */
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
  speed: number
  syncView: boolean

  setPlace: (role: 'start' | 'goal', place: Place | null) => void
  addStop: (place: Place) => void
  removeStop: (i: number) => void

  setDetail: (d: Detail) => void
  build: () => Promise<void>
  loadSample: () => void
  importGraph: (json: string) => void
  /** Đúng khi đang dùng đồ thị mẫu tự thiết kế chứ không phải dữ liệu OpenStreetMap. */
  sample: boolean

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

  run: () => void
  clearResults: () => void
  setStep: (s: number) => void
  setPlaying: (b: boolean) => void
  setSpeed: (s: number) => void
  toggleSync: () => void
}

export const MAX_PANES = 5
const ALGO_ORDER: AlgoKey[] = ['astar', 'ucs', 'bfs', 'dfs', 'greedy']
let seq = 0

export const useStore = create<State>((set, get) => ({
  start: null, goal: null, stops: [],
  detail: 'medium', graph: null, building: false, buildError: null, buildNote: null, sample: false,
  period: 'peak', vehicle: 'bike', criterion: 'balanced',
  weights: { ...CRITERIA.balanced.weights }, optimiseOrder: true,
  panes: [], step: 0, maxStep: 0, playing: false, speed: 1, syncView: true,

  setPlace: (role, place) => {
    const { graph, vehicle, period } = get()
    const anchor: Anchor | null = place
      ? { place, ...(graph ? anchorTo(graph, place, vehicle, period) : { nodeId: null, metres: 0 }) }
      : null
    set({ [role]: anchor } as Pick<State, 'start' | 'goal'>)
    get().clearResults()
  },
  addStop: place => {
    const { graph, vehicle, period } = get()
    const anchor: Anchor = { place, ...(graph ? anchorTo(graph, place, vehicle, period) : { nodeId: null, metres: 0 }) }
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

    // Mạng lưới đứt đoạn thì đổi mức chi tiết giúp người dùng, nhưng đổi theo
    // hướng nào phụ thuộc độ dài chuyến. Chuyến dài cần mức thô hơn vì hành
    // lang tải về rộng hơn, đủ ôm trọn quốc lộ đi vòng. Chuyến ngắn thì ngược
    // lại: thiếu chính là mấy đoạn đường nhỏ nối các trục với nhau.
    const long = haversine(start.place, goal.place) > 25
    // Mức "Cả hẻm" không bao giờ tự chọn giúp: nó nặng và chỉ hợp quãng rất
    // ngắn, nên phải là quyết định của người dùng.
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
          const { vehicle: v, period: pd } = get()
          const reanchor = (a: Anchor): Anchor => ({ ...a, ...anchorTo(graph, a.place, v, pd) })
          set({
            graph, detail, buildNote: note, sample: false,
            start: reanchor(start),
            goal: reanchor(goal),
            stops: stops.map(reanchor),
            building: false,
          })
          get().clearResults()
          return
        } catch (e) {
          const next = fallbacks.shift()
          if (!(e instanceof GraphBuildError) || !e.needsMoreDetail || !next) throw e
          note = `Mức "${DETAIL_LABEL[asked]}" bị đứt đoạn nên đã tự chuyển sang "${DETAIL_LABEL[next]}".`
          detail = next
        }
      }
    } catch (e) {
      set({
        building: false,
        buildError: e instanceof GraphBuildError ? e.message : `Dựng mạng lưới thất bại: ${(e as Error).message}`,
      })
    }
  },

  loadSample: () => {
    const graph = buildSampleGraph()
    const { vehicle: v, period: pd } = get()
    const put = (label: string) => {
      const place = samplePlace(label)
      return { place, ...anchorTo(graph, place, v, pd) }
    }
    set({
      graph, sample: true, buildError: null, buildNote: null, building: false,
      start: put(SAMPLE_START), goal: put(SAMPLE_GOAL), stops: [],
    })
    get().clearResults()
  },

  importGraph: json => {
    try {
      const raw = JSON.parse(json)
      const src = raw.mangLuoi ?? raw
      const nodes: Record<string, Graph['nodes'][string]> = {}
      for (const n of src.nut ?? src.nodes ?? []) nodes[n.id] = n
      const edges = (src.doanDuong ?? src.edges ?? []).map((e: Record<string, unknown>) => ({
        from: e.tu ?? e.from, to: e.den ?? e.to, km: e.km,
        roadClass: e.capDuong ?? e.roadClass ?? 'secondary',
        congestion: e.mucKetXe ?? e.congestion ?? 3,
        risk: e.ruiRo ?? e.risk ?? 0.2,
        name: e.ten ?? e.name ?? undefined,
        shape: e.shape ?? [
          [nodes[(e.tu ?? e.from) as string].lat, nodes[(e.tu ?? e.from) as string].lng],
          [nodes[(e.den ?? e.to) as string].lat, nodes[(e.den ?? e.to) as string].lng],
        ],
      })) as Graph['edges']
      if (!Object.keys(nodes).length || !edges.length) throw new Error('không có nút hoặc cạnh')

      const adj: Graph['adj'] = {}
      for (const id of Object.keys(nodes)) adj[id] = []
      for (const e of edges) adj[e.from]?.push(e)
      const lats = Object.values(nodes).map(n => n.lat), lngs = Object.values(nodes).map(n => n.lng)
      set({
        sample: true, buildError: null, buildNote: `Đã nạp đồ thị từ file: ${Object.keys(nodes).length} nút, ${edges.length} cạnh.`,
        graph: {
          nodes, edges, adj, detail: 'coarse',
          bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        },
      })
      get().clearResults()
    } catch (e) {
      set({ buildError: `File đồ thị không đọc được: ${(e as Error).message}` })
    }
  },

  setPeriod: period => {
    // Đổi khung giờ cũng phải ghim lại như đổi xe: giờ cấm tải đóng hẳn một cấp
    // đường, nên chỗ xe tải đỗ được lúc trưa có thể không rời đi được lúc cao điểm.
    const { graph, vehicle, start, goal, stops } = get()
    const re = (a: Anchor | null) => (a && graph ? { ...a, ...anchorTo(graph, a.place, vehicle, period) } : a)
    set({ period, start: re(start), goal: re(goal), stops: stops.map(s => re(s)!) })
    get().clearResults()
  },
  setVehicle: vehicle => {
    // Đổi xe thì phải ghim lại: chỗ xe máy dừng được chưa chắc xe tải vào được.
    const { graph, period, start, goal, stops } = get()
    const re = (a: Anchor | null) => (a && graph ? { ...a, ...anchorTo(graph, a.place, vehicle, period) } : a)
    set({
      vehicle,
      start: re(start),
      goal: re(goal),
      stops: stops.map(s => re(s)!),
    })
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
    const algo = ALGO_ORDER.find(a => !used.includes(a)) ?? 'astar'
    const pane: Pane = { id: `pane-${++seq}`, algo, view: get().panes[0]?.view ?? 'map', result: null }
    set({ panes: [...panes, pane] })
    // Màn hình thêm giữa chừng chạy ngay để bám vào dòng thời gian chung.
    if (get().maxStep > 0) get().run()
  },
  removePane: id => {
    set({ panes: get().panes.filter(p => p.id !== id) })
    recount(set, get)
  },
  setPaneView: (id, view) => {
    set({ panes: get().panes.map(p => (p.id === id ? { ...p, view } : p)) })
  },
  setPaneAlgo: (id, algo) => {
    // Chỉ chạy lại đúng màn hình vừa đổi. Trước đây chỗ này gọi run() cho cả
    // lưới, kéo theo dòng thời gian nhảy về bước 0 và tự phát lại từ đầu — đang
    // dừng ở bước 150 để chỉ cho ai đó xem thì mất sạch chỗ đang đứng.
    const s = get()
    const input = planInput(s)
    set({
      panes: s.panes.map(p => (p.id === id
        ? { ...p, algo, result: input ? planRoute({ ...input, algo }) : null }
        : p)),
    })
    recount(set, get)
  },
  reorderPanes: (fromId, toId) => {
    const panes = [...get().panes]
    const from = panes.findIndex(p => p.id === fromId)
    const to = panes.findIndex(p => p.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = panes.splice(from, 1)
    panes.splice(to, 0, moved)
    set({ panes })
  },

  run: () => {
    const s = get()
    const input = planInput(s)
    if (!input || !s.panes.length) return
    const panes = s.panes.map(p => ({ ...p, result: planRoute({ ...input, algo: p.algo }) }))
    const maxStep = Math.max(0, ...panes.map(p => p.result.trace.length))
    set({ panes, maxStep, step: 0, playing: true })
  },
  clearResults: () => {
    set({ panes: get().panes.map(p => ({ ...p, result: null })), step: 0, maxStep: 0, playing: false })
  },
  setStep: step => set({ step, playing: false }),
  setPlaying: playing => set({ playing }),
  setSpeed: speed => set({ speed }),
  toggleSync: () => set({ syncView: !get().syncView }),
}))

/** Gói mọi thứ một lượt chạy cần, hoặc null nếu chưa đủ điều kiện chạy. */
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

function recount(set: (p: Partial<State>) => void, get: () => State) {
  const maxStep = Math.max(0, ...get().panes.map(p => (p.result ? p.result.trace.length : 0)))
  set({ maxStep, step: Math.min(get().step, maxStep) })
}
