import L from 'leaflet'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { ALGOS } from '../lib/search'
import { TreeView } from './TreeView'
import type { AlgoKey, Graph } from '../lib/types'
import { useStore, type Anchor, type Pane, type PaneView } from '../store'

const JAM_COLOR = ['#1f9d55', '#1f9d55', '#86b817', '#e8b004', '#e8760a', '#d4342c']
const INK = '#0b0e14'
const OPENED = '#3b5bdb'
const QUEUED = '#9db4f0'
const CURRENT = '#16267a'
const SCHEMA_EDGE = '#cfc7b6'

const VIEWS: PaneView[] = ['map', 'graph', 'tree']
const VIEW_LABEL: Record<PaneView, string> = { map: 'Bản đồ', graph: 'Sơ đồ', tree: 'Cây' }
const VIEW_HINT: Record<PaneView, string> = {
  map: 'Tuyến đường đặt trên bản đồ thật',
  graph: 'Mạng lưới bóc khỏi bản đồ, chỉ còn nút giao và đoạn đường',
  tree: 'Cây tìm kiếm: mỗi nút nối về nút đã dẫn tới nó',
}
/** Nút mở càng lâu càng nhạt, nhưng chỉ chia bốn nấc để đỡ vẽ lại liên tục. */
const FADE = [0.95, 0.74, 0.55, 0.38]

type NodeStyle = { radius: number; color: string; fill: string; opacity: number; weight: number }

const UNTOUCHED: NodeStyle = { radius: 2.4, color: '#b6bcc6', fill: '#b6bcc6', opacity: 0.85, weight: 0 }
/** Mạng lưới càng dày thì nút chưa chạm càng phải mờ đi, nếu không cả ô chỉ còn
 *  là một mảng lấm tấm và dấu chân của thuật toán chìm nghỉm trong đó. */
const untouchedFor = (n: number): NodeStyle =>
  n > 600 ? { ...UNTOUCHED, radius: 1.6, opacity: 0.5 } : UNTOUCHED
const styleQueued  = (): NodeStyle => ({ radius: 3.6, color: QUEUED, fill: '#ffffff', opacity: 1, weight: 1.6 })
const styleCurrent = (): NodeStyle => ({ radius: 5.2, color: CURRENT, fill: '#ffffff', opacity: 1, weight: 2.4 })
const styleOpened  = (band: number): NodeStyle => ({ radius: 3.2, color: OPENED, fill: OPENED, opacity: FADE[band], weight: 0 })

/* Đồng bộ khung nhìn giữa các bản đồ, có cờ chặn để không dội qua dội lại. */
const registry = new Map<string, L.Map>()
let broadcasting = false

interface Props {
  pane: Pane
  onDragStart: () => void
  onDropOn: () => void
}

export function MapPane({ pane, onDragStart, onDropOn }: Props) {
  const graph = useStore(s => s.graph)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const step = useStore(s => s.step)
  const syncView = useStore(s => s.syncView)
  const setPaneAlgo = useStore(s => s.setPaneAlgo)
  const removePane = useStore(s => s.removePane)
  const setPaneView = useStore(s => s.setPaneView)

  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const nodeLayer = useRef<Record<string, L.CircleMarker>>({})
  const styleKeys = useRef<string[]>([])
  const tiles = useRef<L.TileLayer | null>(null)
  const edges = useRef<{ line: L.Polyline; jam: number }[]>([])
  const routeCasing = useRef<L.Polyline | null>(null)
  const routeCore = useRef<L.Polyline | null>(null)
  const marks = useRef<L.Marker[]>([])
  const labels = useRef<L.Marker[]>([])
  const syncRef = useRef(syncView)
  syncRef.current = syncView

  /* ---- Tạo bản đồ một lần ---- */
  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, {
      zoomControl: false, attributionControl: false, preferCanvas: true,
    }).setView([10.79, 106.7], 12)
    tiles.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    })

    m.on('move zoom', () => {
      if (broadcasting || !syncRef.current) return
      broadcasting = true
      const c = m.getCenter(), z = m.getZoom()
      registry.forEach((other, id) => { if (id !== pane.id) other.setView(c, z, { animate: false }) })
      broadcasting = false
    })

    map.current = m
    registry.set(pane.id, m)

    // Leaflet vẽ hỏng khi khung chứa đổi kích thước, phải báo lại kích thước mới.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(host.current)

    return () => { ro.disconnect(); registry.delete(pane.id); m.remove(); map.current = null }
  }, [pane.id])

  /* ---- Vẽ lại mạng lưới khi có mạng lưới mới ---- */
  useEffect(() => {
    const m = map.current
    if (!m) return
    Object.values(nodeLayer.current).forEach(l => l.remove())
    nodeLayer.current = {}
    styleKeys.current = []
    m.eachLayer(l => { if (l instanceof L.Polyline && !(l instanceof L.Polygon)) l.remove() })
    routeCasing.current = null
    routeCore.current = null
    if (!graph) return

    // Cạnh hai chiều được lưu hai lần, chỉ vẽ một lần cho nhẹ.
    edges.current = []
    const drawn = new Set<string>()
    for (const e of graph.edges) {
      const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`
      if (drawn.has(k)) continue
      drawn.add(k)
      edges.current.push({ line: L.polyline(e.shape, { weight: 2.2 }).addTo(m), jam: e.congestion })
    }
    routeCasing.current = L.polyline([], { color: '#ffffff', weight: 8, opacity: 0 }).addTo(m)
    routeCore.current = L.polyline([], { color: INK, weight: 4, opacity: 0 }).addTo(m)

    for (const n of Object.values(graph.nodes))
      nodeLayer.current[n.id] = L.circleMarker([n.lat, n.lng], {
        radius: UNTOUCHED.radius, color: UNTOUCHED.color, fillColor: UNTOUCHED.fill,
        fillOpacity: UNTOUCHED.opacity, weight: 0,
      }).addTo(m)
    for (const n of Object.values(graph.nodes))
      if (n.name) nodeLayer.current[n.id].bindTooltip(`${n.label ? n.label + ' · ' : ''}${n.name}`,
        { direction: 'top', offset: [0, -4] })

    // Đồ thị nhỏ thì gắn nhãn chữ cái lên từng nút — không có nhãn thì không ai
    // dò được "tuyến A → C → F → H" như ví dụ mẫu trong đề.
    labels.current.forEach(l => l.remove())
    labels.current = []
    const list = Object.values(graph.nodes)
    if (list.length <= 40)
      for (const n of list) {
        if (!n.label) continue
        labels.current.push(L.marker([n.lat, n.lng], {
          interactive: false,
          icon: L.divIcon({
            className: '', iconSize: [18, 18], iconAnchor: [-6, 20],
            html: `<div class="node-label">${n.label}</div>`,
          }),
        }).addTo(m))
      }

    m.fitBounds(graph.bounds, { padding: [22, 22] })
  }, [graph])

  /* ---- Đổi giữa bản đồ thật và sơ đồ ---- */
  useEffect(() => {
    const m = map.current
    if (!m || !tiles.current) return
    if (pane.view === 'map') tiles.current.addTo(m)
    else tiles.current.remove()
    if (pane.view !== 'tree') requestAnimationFrame(() => m.invalidateSize())

    // Trên bản đồ, cạnh mang màu mức kẹt xe. Trên sơ đồ, cạnh lùi hết về một sắc
    // trung tính: nền đã sạch thì màu duy nhất còn lại là màu của thuật toán, và
    // dấu chân khám phá nổi lên không còn gì tranh chấp.
    for (const e of edges.current)
      e.line.setStyle(pane.view === 'map'
        ? { color: JAM_COLOR[e.jam], weight: 2.2, opacity: 0.55 }
        : { color: SCHEMA_EDGE, weight: 1.5, opacity: 1 })
  }, [pane.view, graph])

  /* ---- Điểm lấy hàng, điểm giao, điểm ghé ---- */
  useEffect(() => {
    const m = map.current
    if (!m) return
    marks.current.forEach(x => x.remove())
    marks.current = []
    const put = (a: Anchor | null, role: string, title: string) => {
      if (!a) return
      const icon = L.divIcon({
        className: '', iconSize: [13, 13], iconAnchor: [6, 6],
        html: `<div class="marker-endpoint" data-role="${role}"></div>`,
      })
      marks.current.push(L.marker([a.place.lat, a.place.lng], { icon, title }).addTo(m))
    }
    put(start, 'start', `Lấy hàng: ${start?.place.name ?? ''}`)
    stops.forEach((s, i) => put(s, 'stop', `Ghé ${i + 1}: ${s.place.name}`))
    put(goal, 'goal', `Giao: ${goal?.place.name ?? ''}`)
  }, [start, goal, stops, graph])

  /* ---- Bảng tra bước mở nút, dựng lại mỗi khi có kết quả mới ---- */
  const openedAt = useMemo(() => {
    if (!pane.result) return null
    const at = new Int32Array(pane.result.nodeIds.length).fill(-1)
    pane.result.trace.forEach((s, i) => { if (at[s.expanded] < 0) at[s.expanded] = i })
    return at
  }, [pane.result])

  /* ---- Cập nhật theo từng bước ---- */
  useEffect(() => {
    const m = map.current
    if (!m || !graph) return
    const result = pane.result

    const idle = untouchedFor(Object.keys(graph.nodes).length)

    if (!result || !openedAt) {
      applyAll(nodeLayer.current, styleKeys.current, graph, () => ['idle', idle] as [string, NodeStyle])
      routeCasing.current?.setStyle({ opacity: 0 })
      routeCore.current?.setStyle({ opacity: 0 })
      return
    }

    const total = result.trace.length
    const s = Math.min(step, total)
    const frontier = new Set(s > 0 ? result.trace[s - 1].frontier : [])
    const current = s > 0 ? result.trace[s - 1].expanded : -1

    applyAll(nodeLayer.current, styleKeys.current, graph, (idx): [string, NodeStyle] => {
      if (idx === current) return ['cur', styleCurrent()]
      const at = openedAt[idx]
      if (at >= 0 && at < s) {
        const band = Math.min(3, Math.floor(((s - at) / Math.max(total, 1)) * 4))
        return [`op${band}`, styleOpened(band)]
      }
      if (frontier.has(idx)) return ['q', styleQueued()]
      return ['idle', idle]
    }, result.nodeIds)

    let shown: { upto: number; path: string[] } | null = null
    for (const r of result.reveal) if (s >= r.upto) shown = r
    const line = shown ? shown.path.map(id => [graph.nodes[id].lat, graph.nodes[id].lng] as [number, number]) : []
    const geom = shown ? densify(graph, shown.path) : []
    routeCasing.current?.setLatLngs(geom.length ? geom : line).setStyle({ opacity: line.length ? 0.95 : 0 })
    routeCore.current?.setLatLngs(geom.length ? geom : line).setStyle({ opacity: line.length ? 1 : 0 })
  }, [step, pane.result, openedAt, graph])

  const algo = ALGOS.find(a => a.key === pane.algo)!
  const r = pane.result
  const shown = r ? Math.min(step, r.trace.length) : 0
  const done = !!r && shown >= r.trace.length

  return (
    <article
      className="pane"
      style={{ '--algo': algo.hue } as CSSProperties}
      draggable={false}
      onDragOver={e => { e.preventDefault(); e.currentTarget.dataset.over = 'true' }}
      onDragLeave={e => { e.currentTarget.dataset.over = 'false' }}
      onDrop={e => { e.preventDefault(); e.currentTarget.dataset.over = 'false'; onDropOn() }}
    >
      <header
        className="pane-head"
        draggable
        onDragStart={onDragStart}
        title="Kéo để đổi vị trí"
      >
        <select
          value={pane.algo}
          onChange={e => setPaneAlgo(pane.id, e.target.value as AlgoKey)}
          aria-label="Thuật toán"
        >
          {ALGOS.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
        </select>
        <span className="pane-dot" />
        {/* Ba tab thay cho một nút xoay vòng: muốn sang cây thì bấm thẳng vào
            cây, không phải đoán còn mấy lần bấm nữa mới tới. */}
        <div className="pane-tabs" role="tablist" aria-label="Cách xem">
          {VIEWS.map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={pane.view === v}
              data-on={pane.view === v}
              onClick={() => setPaneView(pane.id, v)}
              title={VIEW_HINT[v]}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <span
          className="pane-state"
          data-done={done && !!r?.found}
          data-failed={done && r ? !r.found : false}
        >
          {!r ? 'chưa chạy' : done ? (r.found ? `xong ở bước ${r.trace.length}` : 'không tới được') : `bước ${shown}`}
        </span>
        <button className="pane-close" onClick={() => removePane(pane.id)} aria-label="Đóng màn hình">Đóng</button>
      </header>

      <div className="pane-stage">
        <div className="pane-map" data-view={pane.view} ref={host} />
        {pane.view === 'tree' && <TreeView result={r} step={step} />}
      </div>

      {step > 0 && r && r.trace[Math.min(step, r.trace.length) - 1] && (
        <div className="pane-live">
          <span>nút thứ <span className="num">{Math.min(step, r.trace.length)}</span></span>
          <span>g = <span className="num">{r.trace[Math.min(step, r.trace.length) - 1].g.toFixed(2)}</span></span>
          {r.trace[Math.min(step, r.trace.length) - 1].h !== null && (
            <>
              <span>h = <span className="num">{r.trace[Math.min(step, r.trace.length) - 1].h!.toFixed(2)}</span></span>
              <span>f = <span className="num">{(
                r.trace[Math.min(step, r.trace.length) - 1].g +
                r.trace[Math.min(step, r.trace.length) - 1].h!
              ).toFixed(2)}</span></span>
            </>
          )}
          <span className="pane-live-q">
            hàng đợi <span className="num">{r.trace[Math.min(step, r.trace.length) - 1].frontier.length}</span>
          </span>
        </div>
      )}

      {/* Chân ô nói đúng ba trạng thái khác nhau, không trộn.
          Đang chạy: chưa có tuyến nào nên chưa có quãng đường, thời gian hay
          chi phí để mà nói — hiện số của kết quả cuối là kể trước cái kết.
          Không tới được: ba số ấy bằng không không phải vì tuyến ngắn mà vì
          chẳng có tuyến nào; chỉ giữ hai con số có thật là số nút đã xét và
          thời gian chạy trước khi bỏ cuộc. */}
      <dl className="pane-foot" data-failed={!!r && done && !r.found}>
        {!r ? (
          <dd>{algo.note}</dd>
        ) : !done ? (
          <>
            <dd className="running">đang tìm</dd>
            <dd>đã xét <span className="num">{shown}</span>/<span className="num">{r.metrics.expanded}</span> nút</dd>
            <dd title="Tổng thời gian thuật toán chạy"><span className="num">{r.metrics.ms.toFixed(1)}</span> ms</dd>
          </>
        ) : !r.found ? (
          <>
            <dd className="fail">không có tuyến</dd>
            <dd>đã xét <span className="num">{r.metrics.expanded}</span> nút</dd>
            <dd title="Thời gian thuật toán chạy trước khi bỏ cuộc">
              <span className="num">{r.metrics.ms.toFixed(1)}</span> ms
            </dd>
          </>
        ) : (
          <>
            <dd><span className="num">{r.metrics.km.toFixed(1)}</span> km</dd>
            <dd><span className="num">{r.metrics.minutes}</span> phút</dd>
            <dd title="Tổng chi phí theo hàm chi phí đang đặt">
              chi phí <span className="num">{r.metrics.cost.toFixed(1)}</span>
            </dd>
            <dd><span className="num">{shown}</span>/<span className="num">{r.metrics.expanded}</span> nút</dd>
            <dd title="Thời gian thuật toán chạy"><span className="num">{r.metrics.ms.toFixed(1)}</span> ms</dd>
            {r.metrics.turnsBlocked > 0 && (
              <dd title="Số lần phải bỏ một hướng đi vì gặp biển cấm rẽ lấy từ OpenStreetMap">
                <span className="num">{r.metrics.turnsBlocked}</span> cấm rẽ
              </dd>
            )}
            {done && <dd className="verdict">{r.metrics.optimal ? 'tối ưu' : 'xấp xỉ'}</dd>}
          </>
        )}
      </dl>
    </article>
  )
}

/** Đổi style cho những nút thật sự đổi trạng thái, bỏ qua phần còn lại. */
function applyAll(
  layers: Record<string, L.CircleMarker>,
  keys: string[],
  graph: Graph,
  pick: (idx: number) => [string, NodeStyle],
  ids?: string[],
) {
  const list = ids ?? Object.keys(graph.nodes)
  for (let i = 0; i < list.length; i++) {
    const [key, style] = pick(i)
    if (keys[i] === key) continue
    keys[i] = key
    const layer = layers[list[i]]
    if (!layer) continue
    layer.setStyle({
      radius: style.radius, color: style.color, fillColor: style.fill,
      fillOpacity: style.opacity, opacity: style.opacity, weight: style.weight,
    })
  }
}

/** Nối hình dạng thật của từng đoạn đường để tuyến bám đúng mặt đường. */
function densify(graph: Graph, path: string[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < path.length; i++) {
    const e = graph.adj[path[i]]?.find(x => x.to === path[i + 1])
    if (!e) continue
    const seg = e.shape
    out.push(...(out.length ? seg.slice(1) : seg))
  }
  return out
}
