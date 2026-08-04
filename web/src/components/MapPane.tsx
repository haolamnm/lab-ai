import L from 'leaflet'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { algoOf, ALGOS, edgeBetween } from '../lib/search'
import { tripNames } from '../lib/tripNames'
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
const VIEW_LABEL: Record<PaneView, string> = { map: 'Map', graph: 'Schematic', tree: 'Tree' }
const VIEW_HINT: Record<PaneView, string> = {
  map: 'Route drawn on the real map',
  graph: 'Network stripped from the map, leaving only intersections and road segments',
  tree: 'Search tree: each node connects to the node that led to it',
}
/** The longer a node has been open, the fainter it gets — but only four bands, so we're not restyling on every frame. */
const FADE = [0.95, 0.74, 0.55, 0.38]

type NodeStyle = { radius: number; color: string; fill: string; opacity: number; weight: number }

const UNTOUCHED: NodeStyle = { radius: 2.4, color: '#b6bcc6', fill: '#b6bcc6', opacity: 0.85, weight: 0 }
/** The denser the network, the more untouched nodes need to fade, otherwise the whole
 *  pane is just a speckled mass and the algorithm's exploration footprint disappears into it. */
const untouchedFor = (n: number): NodeStyle =>
  n > 600 ? { ...UNTOUCHED, radius: 1.6, opacity: 0.5 } : UNTOUCHED
const styleQueued  = (): NodeStyle => ({ radius: 3.6, color: QUEUED, fill: '#ffffff', opacity: 1, weight: 1.6 })
const styleCurrent = (): NodeStyle => ({ radius: 5.2, color: CURRENT, fill: '#ffffff', opacity: 1, weight: 2.4 })
const styleOpened  = (band: number): NodeStyle => ({ radius: 3.2, color: OPENED, fill: OPENED, opacity: FADE[band], weight: 0 })

/* Syncs the view across maps, with a guard flag so updates don't bounce back and forth. */
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

  /* ---- Create the map once ---- */
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

    // Leaflet's rendering breaks when its container is resized, so it needs to be told the new size.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(host.current)

    return () => { ro.disconnect(); registry.delete(pane.id); m.remove(); map.current = null }
  }, [pane.id])

  /* ---- Redraw the network whenever a new network arrives ---- */
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

    // Two-way edges are stored twice; draw each one only once to keep it light.
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

    // For a small graph, a letter label goes on every node — without labels nobody
    // could trace a route like "A → C → F → H" the way the sample problem does.
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

  /* ---- Switch between the real map and the schematic ---- */
  useEffect(() => {
    const m = map.current
    if (!m || !tiles.current) return
    if (pane.view === 'map') tiles.current.addTo(m)
    else tiles.current.remove()
    if (pane.view !== 'tree') requestAnimationFrame(() => m.invalidateSize())

    // On the map, edges carry the congestion color. On the schematic, edges recede
    // to a single neutral tone: once the background is clean, the only color left
    // is the algorithm's, and the exploration footprint stands out uncontested.
    for (const e of edges.current)
      e.line.setStyle(pane.view === 'map'
        ? { color: JAM_COLOR[e.jam], weight: 2.2, opacity: 0.55 }
        : { color: SCHEMA_EDGE, weight: 1.5, opacity: 1 })
  }, [pane.view, graph])

  /* ---- Pickup, dropoff, and stop markers ---- */
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
    put(start, 'start', `Pickup: ${start?.place.name ?? ''}`)
    stops.forEach((s, i) => put(s, 'stop', `Stop ${i + 1}: ${s.place.name}`))
    put(goal, 'goal', `Dropoff: ${goal?.place.name ?? ''}`)
  }, [start, goal, stops, graph])

  /* ---- Lookup table of the step each node opened at, rebuilt whenever a new result arrives ---- */
  const openedAt = useMemo(() => {
    if (!pane.result) return null
    const at = new Int32Array(pane.result.nodeIds.length).fill(-1)
    pane.result.trace.forEach((s, i) => { if (at[s.expanded] < 0) at[s.expanded] = i })
    return at
  }, [pane.result])

  /* ---- Update per step ---- */
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

  const algo = algoOf(pane.algo)
  // Held–Karp reports `ms` as the runtime of the A* legs it ended up choosing.
  // That is neither the full pairwise search — which routes every ordered pair
  // of trip points, most of which the winning tour never uses — nor the DP,
  // which the backend does not time at all. Labelling it "total running time"
  // would claim the algorithm did far less work than it did.
  const msTitle = pane.algo === 'held_karp'
    ? 'Runtime of the A* legs on the chosen tour — not the full pairwise search, and not the DP'
    : 'Algorithm running time'
  const r = pane.result
  const shown = r ? Math.min(step, r.trace.length) : 0
  const done = !!r && shown >= r.trace.length
  // A failed result splits in two, and the pane must not blur them. A route
  // that is genuinely unreachable was searched for: the algorithm expanded
  // nodes, exhausted them, and found nothing. A query that never ran at all —
  // Held–Karp without a backend, a pickup and dropoff on one intersection —
  // produced no trace, so "unreachable" would state a fact about the road
  // network that nothing here established, and the node and millisecond counts
  // beside it would be zeros standing for nothing. `Explain` prints the reason.
  const ranNothing = !!r && !r.found && r.trace.length === 0

  /**
   * The order this pane's algorithm chose to visit the stops in.
   *
   * This belongs per pane rather than only in the explanation block below,
   * because on a multi-stop trip the order *is* the difference between the
   * algorithms: Nearest Neighbor takes the locally cheapest next stop, Held–Karp
   * prices every possible tour. The explanation only ever describes the winning
   * pane, so until this line existed, a Held–Karp run that lost on cost gave the
   * viewer no way to see the one thing it does differently.
   *
   * Held on until the run finishes, for the same reason the footer holds back
   * the distance and the cost: the order is the answer, and showing it while the
   * search is still playing gives away the ending.
   *
   * A trip with no stops has an order of pickup-then-dropoff, which the map
   * already shows and which no algorithm had any choice about.
   */
  const visitOrder = useMemo(
    () => (r?.found && r.order.length > 2 ? r.order.map(tripNames(start, goal, stops)) : null),
    [r, start, goal, stops],
  )
  /** The step currently on screen. Read seven times below; indexed once here. */
  const cur = r ? r.trace[shown - 1] : undefined

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
        title="Drag to reorder"
      >
        <select
          value={pane.algo}
          onChange={e => setPaneAlgo(pane.id, e.target.value as AlgoKey)}
          aria-label="Algorithm"
        >
          {ALGOS.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
        </select>
        <span className="pane-dot" />
        {/* Three tabs instead of one cycling button: to jump to the tree, click the
            tree directly, instead of guessing how many more clicks it takes. */}
        <div className="pane-tabs" role="tablist" aria-label="View mode">
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
          {!r ? 'not run'
            : ranNothing ? 'did not run'
              : done ? (r.found ? `done at step ${r.trace.length}` : 'unreachable')
                : `step ${shown}`}
        </span>
        <button className="pane-close" onClick={() => removePane(pane.id)} aria-label="Close pane">Close</button>
      </header>

      <div className="pane-stage">
        <div className="pane-map" data-view={pane.view} ref={host} />
        {pane.view === 'tree' && <TreeView result={r} step={step} />}
      </div>

      {step > 0 && cur && (
        <div className="pane-live">
          <span>node <span className="num">{shown}</span></span>
          <span>g = <span className="num">{cur.g.toFixed(2)}</span></span>
          {cur.h !== null && (
            <>
              <span>h = <span className="num">{cur.h.toFixed(2)}</span></span>
              <span>f = <span className="num">{(cur.g + cur.h).toFixed(2)}</span></span>
            </>
          )}
          <span className="pane-live-q">
            frontier <span className="num">{cur.frontier.length}</span>
          </span>
        </div>
      )}

      {/* The pane footer states exactly three distinct situations, never blended.
          Running: there's no route yet, so there's no distance, time, or cost to
          report — showing the final numbers early would spoil the ending.
          Unreachable: those three numbers would read as zero not because the route
          is short but because there is no route; keep only the two numbers that are
          real — nodes expanded and the running time before giving up. */}
      <dl className="pane-foot" data-failed={!!r && done && !r.found}>
        {!r ? (
          <dd>{algo.note}</dd>
        ) : !done ? (
          <>
            <dd className="running">searching</dd>
            <dd>expanded <span className="num">{shown}</span>/<span className="num">{r.metrics.expanded}</span> nodes</dd>
            <dd title={msTitle}><span className="num">{r.metrics.ms.toFixed(1)}</span> ms</dd>
          </>
        ) : ranNothing ? (
          <dd className="fail">did not run — see the reason below</dd>
        ) : !r.found ? (
          <>
            <dd className="fail">no route</dd>
            <dd>expanded <span className="num">{r.metrics.expanded}</span> nodes</dd>
            <dd title="Algorithm running time before giving up">
              <span className="num">{r.metrics.ms.toFixed(1)}</span> ms
            </dd>
          </>
        ) : (
          <>
            <dd><span className="num">{r.metrics.km.toFixed(1)}</span> km</dd>
            <dd><span className="num">{r.metrics.minutes}</span> min</dd>
            <dd title="Total cost under the current cost function">
              cost <span className="num">{r.metrics.cost.toFixed(1)}</span>
            </dd>
            <dd><span className="num">{shown}</span>/<span className="num">{r.metrics.expanded}</span> nodes</dd>
            <dd title={msTitle}><span className="num">{r.metrics.ms.toFixed(1)}</span> ms</dd>
            {r.metrics.turnsBlocked > 0 && (
              <dd title="Number of times a direction was ruled out by a turn restriction sign from OpenStreetMap">
                <span className="num">{r.metrics.turnsBlocked}</span> turn restrictions
              </dd>
            )}
            {done && <dd className="verdict">{r.metrics.optimal ? 'optimal' : 'approximate'}</dd>}
          </>
        )}
      </dl>

      {done && visitOrder && (
        <p className="pane-order" title={`Visit order chosen by ${algo.name}`}>
          {visitOrder.join(' → ')}
        </p>
      )}
    </article>
  )
}

/** Restyle only the nodes whose state actually changed; skip the rest. */
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

/** Stitch together each road segment's real shape so the route hugs the actual roads. */
function densify(graph: Graph, path: string[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < path.length; i++) {
    const e = edgeBetween(graph, path[i], path[i + 1])
    if (!e) continue
    const seg = e.shape
    out.push(...(out.length ? seg.slice(1) : seg))
  }
  return out
}
