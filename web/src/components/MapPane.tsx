import L from 'leaflet'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { backendEnabled } from '../lib/planClient'
import { ALGOS, edgeBetween, runtimeNote } from '../lib/search'
import { nodeNames, tripNames } from '../lib/tripNames'
import { broadcastView, joinViewSync, resetViewSync, sharedView } from '../lib/viewSync'
import { TreeView } from './TreeView'
import type { AlgoKey, Graph } from '../lib/types'
import { useStore, type Anchor, type Pane, type PaneView } from '../store'

const JAM_COLOR = ['#1f9d55', '#1f9d55', '#86b817', '#e8b004', '#e8760a', '#d4342c']
/**
 * The chosen route.
 *
 * Amber, not the ink it used to be. Black is the colour of every label the base
 * map prints, so the answer was drawn in the one hue guaranteed to be already
 * everywhere on screen, and it had to be traced rather than seen.
 *
 * It does sit inside the congestion ramp's warm end, which is why the ramp is
 * dimmed to a quarter opacity the moment a route appears (see the view effect):
 * the route is the only saturated thing left, at nearly three times the width,
 * under a white casing no road segment has.
 */
const ROUTE = '#f59e0b'
/** Dark edge around the amber, so the route keeps its shape over pale ground. */
const ROUTE_EDGE = '#7a4405'
const OPENED = '#3b5bdb'
const QUEUED = '#9db4f0'
const CURRENT = '#16267a'

const VIEWS: PaneView[] = ['map', 'tree']
const VIEW_LABEL: Record<PaneView, string> = { map: 'Map', tree: 'Tree' }
const VIEW_HINT: Record<PaneView, string> = {
  map: 'Route drawn on the real map',
  tree: 'Search tree: each node connects to the node that led to it',
}
/** The longer a node has been open, the fainter it gets — but only four bands, so we're not restyling on every frame. */
const FADE = [0.95, 0.74, 0.55, 0.38]

interface NodeStyle { radius: number; color: string; fill: string; opacity: number; weight: number }

const UNTOUCHED_COLOR = '#b6bcc6'

/** Every dot the pane draws, sized for one particular network. */
interface Dots {
  untouched: number
  untouchedOpacity: number
  opened: number
  queued: number
  queuedWeight: number
  current: number
  /** Radius for an intersection on the chosen route, or null to draw none at all. */
  path: number | null
}

/**
 * How big the dots are, decided by how crowded the network is.
 *
 * These sizes were tuned on the twenty-node sample graph, where a fat dot per
 * intersection is exactly what you want. A real OpenStreetMap extract is a few
 * hundred intersections inside the same pane, and at that density the same
 * sizes overlap into a speckled mass with the road network lost underneath it.
 *
 * Past a couple of hundred nodes the route also stops marking its own
 * intersections. A route of fifty hops was drawing fifty amber discs along a
 * five-pixel amber line, and the line came out looking like a beaded chain
 * rather than a road — the marking swallowed the thing being marked. The line
 * is the route; the ends of it are already marked by the pickup and dropoff
 * pins. On the sample graph the dots stay, because there the whole point is to
 * name the handful of intersections the route runs through.
 */
function dotsFor(n: number): Dots {
  if (n > 600)
    return { untouched: 1.3, untouchedOpacity: 0.4, opened: 1.8, queued: 2, queuedWeight: 1, current: 4.2, path: null }
  if (n > 200)
    return { untouched: 1.7, untouchedOpacity: 0.55, opened: 2.3, queued: 2.6, queuedWeight: 1.2, current: 4.6, path: null }
  return { untouched: 2.4, untouchedOpacity: 0.85, opened: 3.2, queued: 3.6, queuedWeight: 1.6, current: 5.2, path: 3.6 }
}

/**
 * The parts of the city nobody looked at.
 *
 * They fade further once a route is on screen: by then they have said
 * everything they have to say, and every dot they contribute is one more thing
 * the answer has to be picked out from.
 */
const styleUntouched = (d: Dots, routed: boolean): NodeStyle => ({
  radius: d.untouched, color: UNTOUCHED_COLOR, fill: UNTOUCHED_COLOR,
  opacity: routed ? d.untouchedOpacity * 0.45 : d.untouchedOpacity, weight: 0,
})
const styleQueued  = (d: Dots): NodeStyle => ({ radius: d.queued, color: QUEUED, fill: '#ffffff', opacity: 1, weight: d.queuedWeight })
const styleCurrent = (d: Dots): NodeStyle => ({ radius: d.current, color: CURRENT, fill: '#ffffff', opacity: 1, weight: 2.4 })
const styleOpened  = (d: Dots, opacity: number): NodeStyle =>
  ({ radius: d.opened, color: OPENED, fill: OPENED, opacity, weight: 0 })
/** An intersection the chosen route passes through — amber, like the route itself. */
const stylePath    = (radius: number): NodeStyle => ({ radius, color: ROUTE_EDGE, fill: ROUTE, opacity: 1, weight: 1.2 })

/**
 * The network the panes have already fitted themselves to.
 *
 * Every pane runs the redraw effect below when a new network arrives, but only
 * the first one through should fit to it — the rest adopt the shared view that
 * first fit established, and so does any pane added later. Without this, a pane
 * added an hour into a session would refit to the whole network and drag every
 * other pane out of whatever corner the user was studying.
 */
let fittedTo: Graph | null = null

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
  /** The dashed hops from each pinned place to the intersection it snapped to. */
  const walks = useRef<L.Polyline[]>([])
  const labels = useRef<L.Marker[]>([])
  const syncRef = useRef(syncView)
  syncRef.current = syncView
  /** True while this pane is being moved by the sync rather than by the user. */
  const following = useRef(false)

  useEffect(() => {
    if (!host.current || map.current) return
    // Zoom snapping is left at Leaflet's default. Fractional zoom (`zoomSnap: 0`)
    // was tried here to make the wheel a continuous slide for the other panes to
    // follow, and it made the whole grid crawl: every wheel tick became its own
    // zoom animation, each one broadcast, and each broadcast forced every other
    // pane to reproject and repaint several hundred canvas paths. Snapping keeps
    // one gesture to one animation, and the panes stay together by animating
    // alongside it instead of being driven frame by frame.
    const m = L.map(host.current, {
      zoomControl: false, attributionControl: false, preferCanvas: true,
    }).setView([10.79, 106.7], 12)
    tiles.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    })

    const tell = (lat: number, lng: number, zoom: number) => {
      // A pane that is currently being moved *by* the sync must not answer back:
      // its own move events are an echo of the broadcast it just received, and
      // an animated follow finishes long after the guard inside `broadcastView`
      // has been released.
      if (!syncRef.current || following.current) return
      broadcastView(pane.id, { lat, lng, zoom })
    }

    m.on('move zoom', () => {
      const c = m.getCenter()
      tell(c.lat, c.lng, m.getZoom())
    })

    /**
     * Also announce a zoom while it is still animating.
     *
     * Dragging fires `move` continuously, so the other panes track it frame by
     * frame. A wheel zoom does not: Leaflet animates it with a CSS transform and
     * only fires `zoom`/`move` once the animation has landed, so every other
     * pane sat perfectly still and then snapped, all at once, at the end.
     *
     * `zoomanim` fires as the animation *starts* and carries where it is going —
     * once per gesture, not once per frame. Handing that on lets the followers
     * set off at the same moment the leader does.
     */
    m.on('zoomanim', (e: L.ZoomAnimEvent) => tell(e.center.lat, e.center.lng, e.zoom))

    // Once a follow has landed, this pane may speak again.
    m.on('moveend zoomend', () => { following.current = false })

    map.current = m
    /**
     * Follow someone else's view.
     *
     * A zoom is animated, so this pane travels alongside the pane that moved
     * rather than teleporting to the end of its journey — matched to Leaflet's
     * own default zoom duration, so the two arrive together.
     *
     * A pan is not. Dragging broadcasts on every frame, and animating each of
     * those over a quarter of a second would queue hundreds of overlapping
     * animations and leave this pane visibly trailing the cursor.
     */
    const leave = joinViewSync(pane.id, v => {
      const zooming = Math.abs(m.getZoom() - v.zoom) > 1e-6
      following.current = true
      m.setView([v.lat, v.lng], v.zoom, zooming ? { animate: true, duration: 0.25 } : { animate: false })
      // The instant path fires its events synchronously inside `setView`, so by
      // here they are already spent and the guard can come straight back off.
      // The animated path clears it on `zoomend` instead.
      if (!zooming) following.current = false
    })

    // Leaflet's rendering breaks when its container is resized, so it needs to be told the new size.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(host.current)

    return () => { ro.disconnect(); leave(); m.remove(); map.current = null }
  }, [pane.id])

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
    routeCasing.current = L.polyline([], { color: ROUTE_EDGE, weight: 8.5, opacity: 0 }).addTo(m)
    routeCore.current = L.polyline([], { color: ROUTE, weight: 5, opacity: 0 }).addTo(m)

    const idle = styleUntouched(dotsFor(Object.keys(graph.nodes).length), false)
    for (const n of Object.values(graph.nodes)) {
      const marker = L.circleMarker([n.lat, n.lng], circleStyle(idle)).addTo(m)
      if (n.name) marker.bindTooltip(`${n.label ? n.label + ' · ' : ''}${n.name}`, { direction: 'top', offset: [0, -4] })
      nodeLayer.current[n.id] = marker
    }

    // For a small graph, a letter label goes on every node — without labels nobody
    // could trace a route like "A → C → F → H" the way the sample problem does.
    clearLayers(labels)
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

    // A new network means the old centre and zoom point at a different part of
    // the world, so the first pane to arrive throws the shared view away and
    // fits afresh. Every pane after it — including one added an hour later —
    // adopts what that fit produced instead of imposing its own.
    if (fittedTo !== graph) {
      fittedTo = graph
      resetViewSync()
    }
    // Deferred a frame, and cancelled if this effect is torn down first.
    //
    // React StrictMode mounts every effect, unmounts it, and mounts it again in
    // development. Moving the map inside the discarded mount leaves Leaflet
    // mid-flight when `m.remove()` arrives: tearing a map down removes each path,
    // and removing a path asks the canvas renderer for a redraw — which is then
    // left with no canvas to draw into. Doing the move on the next frame means
    // the throwaway mount never touches the map at all.
    const frame = requestAnimationFrame(() => {
      const shared = syncRef.current ? sharedView() : null
      if (shared) m.setView([shared.lat, shared.lng], shared.zoom, { animate: false })
      else m.fitBounds(graph.bounds, { padding: [22, 22] })
    })
    return () => cancelAnimationFrame(frame)
  }, [graph])

  /**
   * Switching sync back on aligns every pane to this one, when this is the
   * leftmost pane.
   *
   * Sync used to take effect only on the next drag, so the button could read
   * "synced" over panes visibly showing different places. Something has to be
   * chosen as the one everyone else moves to, and the leftmost pane is the one
   * choice the user can predict without being told.
   */
  const leads = useStore(s => s.panes[0]?.id === pane.id)
  useEffect(() => {
    const m = map.current
    if (!m || !syncView || !leads) return
    const c = m.getCenter()
    // Sent as coming *from* this pane, so the broadcast skips it. Passing `null`
    // here would include the leader in its own realignment — a setView onto the
    // view it is already at. Harmless in principle, but it queues a Leaflet
    // canvas redraw, and under StrictMode's mount/unmount/remount the map is
    // torn down before that frame runs, leaving it to redraw into a canvas
    // context that no longer exists.
    broadcastView(pane.id, { lat: c.lat, lng: c.lng, zoom: m.getZoom() })
  }, [syncView, leads])

  /**
   * Whether a route is currently drawn — the whole network gets quieter once
   * there is an answer to look at.
   */
  const drawn = pane.result
  const routed = !!drawn && drawn.reveal.some(rv => Math.min(step, drawn.trace.length) >= rv.upto)

  useEffect(() => {
    const m = map.current
    if (!m || !tiles.current) return
    if (pane.view === 'map') { tiles.current.addTo(m); requestAnimationFrame(() => m.invalidateSize()) }
    else tiles.current.remove()

    // Once a route is drawn, every edge steps back. A congestion scale running
    // green to red is the loudest thing on the pane, and on a dense network the
    // chosen route was competing with a few thousand saturated segments for the
    // reader's attention — it is the answer, so it wins outright.
    for (const e of edges.current)
      e.line.setStyle({
        color: JAM_COLOR[e.jam],
        weight: routed ? 1.7 : 2.2,
        opacity: routed ? 0.24 : 0.55,
      })
    // No `bringToFront` here. The two route polylines are created after every
    // edge in the redraw effect above, and Leaflet stacks by insertion order, so
    // they are already on top. Calling it anyway queued a Leaflet redraw frame
    // that StrictMode's second mount then outlived — the map was torn down first,
    // and the pending frame hit a canvas context that no longer existed.
  }, [pane.view, graph, routed])

  useEffect(() => {
    const m = map.current
    if (!m) return
    clearLayers(marks)
    clearLayers(walks)
    const put = (a: Anchor | null, role: string, title: string) => {
      if (!a) return
      const icon = L.divIcon({
        className: '', iconSize: [13, 13], iconAnchor: [6, 6],
        html: `<div class="marker-endpoint" data-role="${role}"></div>`,
      })
      marks.current.push(L.marker([a.place.lat, a.place.lng], { icon, title }).addTo(m))

      /**
       * The last few metres, from the place the user picked to the intersection
       * the route can actually start or finish at.
       *
       * The pin is drawn where the user pointed; the route runs between
       * junctions in the road network. On a coarse network those are tens of
       * metres apart, and the pin sat off to one side of the route's end with
       * nothing joining them — which reads as "the algorithm never got there",
       * when in fact it reached the only node there was to reach. The sidebar
       * has always printed the distance; this draws it.
       *
       * Dashed and thin on purpose: this is the part nobody drives.
       */
      const node = a.nodeId ? graph?.nodes[a.nodeId] : undefined
      if (node && a.metres > 0) {
        walks.current.push(L.polyline(
          [[a.place.lat, a.place.lng], [node.lat, node.lng]],
          { color: ROUTE_EDGE, weight: 1.4, opacity: 0.7, dashArray: '3 4', interactive: false },
        ).addTo(m).bindTooltip(`${a.metres} m to the nearest intersection`))
      }
    }
    put(start, 'start', `Pickup: ${start?.place.name ?? ''}`)
    stops.forEach((s, i) => put(s, 'stop', `Stop ${i + 1}: ${s.place.name}`))
    put(goal, 'goal', `Dropoff: ${goal?.place.name ?? ''}`)
  }, [start, goal, stops, graph])

  const openedAt = useMemo(() => {
    if (!pane.result) return null
    const at = new Int32Array(pane.result.nodeIds.length).fill(-1)
    pane.result.trace.forEach((s, i) => { if ((at[s.expanded] ?? 0) < 0) at[s.expanded] = i })
    return at
  }, [pane.result])

  useEffect(() => {
    const m = map.current
    if (!m || !graph) return
    const result = pane.result

    const dots = dotsFor(Object.keys(graph.nodes).length)

    if (!result || !openedAt) {
      const idle = styleUntouched(dots, false)
      applyAll(nodeLayer.current, styleKeys.current, graph, () => ['idle', idle] as [string, NodeStyle])
      routeCasing.current?.setStyle({ opacity: 0 })
      routeCore.current?.setStyle({ opacity: 0 })
      return
    }

    const total = result.trace.length
    const s = Math.min(step, total)
    const at = s > 0 ? result.trace[s - 1] : undefined
    const frontier = new Set(at?.frontier ?? [])
    const current = at?.expanded ?? -1

    let shown: { upto: number; path: string[] } | null = null
    for (const r of result.reveal) if (s >= r.upto) shown = r

    // The intersections the route runs through, by trace index — only worth
    // collecting on a network small enough for them to be marked individually.
    const idle = styleUntouched(dots, !!shown)
    const onRoute = new Set<number>()
    if (shown && dots.path !== null) {
      const indexOf = new Map(result.nodeIds.map((id, i) => [id, i]))
      for (const id of shown.path) {
        const i = indexOf.get(id)
        if (i !== undefined) onRoute.add(i)
      }
    }

    /**
     * The search is over and this pane has an answer to show.
     *
     * The exploration footprint is cleared at this point: the expanded nodes,
     * the frontier ring, and the marker on the node being expanded all go, and
     * the pane is left holding the route and nothing else. While the search is
     * playing those marks are the whole story, but once it has stopped they are
     * a record of work already finished, sitting on top of the result — on a
     * real city extract that is a few hundred blue dots covering the answer.
     *
     * Nothing is lost that the pane does not still say: the footer keeps the
     * count of nodes expanded, which is the number the footprint stood for, and
     * dragging the timeline back a single step brings the whole cloud straight
     * back.
     */
    const settled = result.found && s >= total

    applyAll(nodeLayer.current, styleKeys.current, graph, (idx): [string, NodeStyle] => {
      if (!settled && idx === current) return ['cur', styleCurrent(dots)]
      if (dots.path !== null && onRoute.has(idx)) return ['path', stylePath(dots.path)]
      if (!settled) {
        const at = openedAt[idx] ?? -1
        if (at >= 0 && at < s) {
          const band = Math.min(FADE.length - 1, Math.floor(((s - at) / Math.max(total, 1)) * 4))
          const fade = FADE[band]
          if (fade !== undefined) return [`op${band}`, styleOpened(dots, fade)]
        }
        if (frontier.has(idx)) return ['q', styleQueued(dots)]
      }
      // The key has to carry the routed state too: `applyAll` skips any node
      // whose key is unchanged, so a bare 'idle' would leave every untouched
      // node at its old opacity on the very step the route appears.
      return [shown ? 'idle-r' : 'idle', idle]
    }, result.nodeIds)

    const line = shown
      ? shown.path.flatMap(id => {
        const node = graph.nodes[id]
        return node ? [[node.lat, node.lng] as [number, number]] : []
      })
      : []
    const geom = shown ? densify(graph, shown.path) : []
    routeCasing.current?.setLatLngs(geom.length ? geom : line).setStyle({ opacity: line.length ? 0.95 : 0 })
    routeCore.current?.setLatLngs(geom.length ? geom : line).setStyle({ opacity: line.length ? 1 : 0 })
  }, [step, pane.result, openedAt, graph])

  const algo = ALGOS[pane.algo]
  const optimiseOrder = useStore(s => s.optimiseOrder)
  // What the runtime figure counted depends on the run, not on the algorithm —
  // which planner answered, and whether there was an ordering step. `optimiseOrder`
  // is read from the store rather than off the result because `setOptimiseOrder`
  // clears every result, so the flag cannot describe a run other than this one.
  const msTitle = runtimeNote(pane.algo, { remote: backendEnabled, optimiseOrder })
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

  /** Names any intersection the tree wants to talk about, not only the pinned ones. */
  const nameOfNode = useMemo(
    () => (graph ? nodeNames(graph, start, goal, stops) : () => undefined),
    [graph, start, goal, stops],
  )

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
          {Object.values(ALGOS).map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
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
        {pane.view === 'tree' && (
          <TreeView result={r} step={step} graph={graph} nameOf={nameOfNode} />
        )}
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

/** Remove every layer a ref is tracking and empty it, ready for the next redraw. */
function clearLayers<T extends L.Layer>(ref: { current: T[] }): void {
  ref.current.forEach(l => l.remove())
  ref.current = []
}

/** The Leaflet circle-marker options a node style maps to — shared by the initial draw and every restyle. */
function circleStyle(s: NodeStyle): L.CircleMarkerOptions {
  return { radius: s.radius, color: s.color, fillColor: s.fill, fillOpacity: s.opacity, opacity: s.opacity, weight: s.weight }
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
  list.forEach((id, i) => {
    const [key, style] = pick(i)
    if (keys[i] === key) return
    keys[i] = key
    layers[id]?.setStyle(circleStyle(style))
  })
}

/** Stitch together each road segment's real shape so the route hugs the actual roads. */
function densify(graph: Graph, path: string[]): [number, number][] {
  const out: [number, number][] = []
  let previous: string | null = null
  for (const node of path) {
    const e = previous === null ? undefined : edgeBetween(graph, previous, node)
    previous = node
    if (!e) continue
    out.push(...(out.length ? e.shape.slice(1) : e.shape))
  }
  return out
}
