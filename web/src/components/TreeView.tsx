import { useEffect, useMemo, useRef, useState } from 'react'
import { buildTree } from '../lib/tree'
import type { RouteResult } from '../lib/types'

const OPENED = '#3b5bdb'
const CURRENT = '#16267a'
const ON_PATH = '#23201b'

const MIN_ZOOM = 0.6
const MAX_ZOOM = 40

interface Props {
  result: RouteResult | null
  step: number
}

/** Viewport position: how far it's panned, how much it's zoomed. */
interface Camera { x: number; y: number; k: number }

/**
 * Scale by `factor` while holding `anchor` still on screen.
 *
 * The wheel holds the point under the cursor; the buttons hold the pane's
 * centre. Only the anchor differs, but the arithmetic that keeps it fixed is
 * easy to get subtly wrong, and with a copy on each path a sign error gets
 * fixed for the wheel and left in the buttons.
 */
function zoomAround(c: Camera, factor: number, anchor: { x: number; y: number }): Camera {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.k * factor))
  const ratio = k / c.k
  return { k, x: anchor.x - (anchor.x - c.x) * ratio, y: anchor.y - (anchor.y - c.y) * ratio }
}
const HOME: Camera = { x: 0, y: 0, k: 1 }

/**
 * One algorithm's search tree, laid out radially.
 *
 * Shares the timeline with the map: drag to a step and the tree grows to
 * match. The branch that lies on the final route is inked in black so you can
 * see which branches of the tree the actual path went through.
 *
 * A tree of a few hundred nodes only shows its overall shape at a glance;
 * reading individual branches needs zoom — hence scroll to zoom, drag to pan,
 * double-click to fit the pane.
 */
export function TreeView({ result, step }: Props) {
  const tree = useMemo(() => (result ? buildTree(result) : null), [result])
  const svg = useRef<SVGSVGElement>(null)
  const [cam, setCam] = useState<Camera>(HOME)
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null)

  // A new run means a completely different tree; keeping the old viewport would just leave you lost.
  useEffect(() => setCam(HOME), [result])

  const onPath = useMemo(() => {
    if (!result) return new Set<number>()
    const index = new Map(result.nodeIds.map((id, i) => [id, i]))
    return new Set(result.path.map(id => index.get(id)!).filter(i => i !== undefined))
  }, [result])

  /** Convert screen cursor coordinates to coordinates inside the drawing frame. */
  const atCursor = (e: { clientX: number; clientY: number }) => {
    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (!el || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  // The wheel listener is registered manually: React attaches the wheel event as
  // passive, so preventDefault inside onWheel has no effect, and the whole page would scroll along with it.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = atCursor(e)
      // Keep the point under the cursor fixed — that's what the user is looking at.
      setCam(c => zoomAround(c, Math.exp(-e.deltaY * 0.0016), p))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const shown = result ? Math.min(step, result.trace.length) : 0

  const frame = useMemo(() => {
    if (!tree?.nodes.length) return null
    const [xMin, yMin, xMax, yMax] = tree.bounds
    const pad = Math.max(1, (xMax - xMin + yMax - yMin) * 0.04)
    // The bigger the tree, the finer the strokes need to be, otherwise the whole
    // pane turns into one solid mass. Dot size is measured against the distance
    // between two levels, always 1 — not against the bounding box, because a deep
    // tree's bounding box grows wide while the levels stay exactly as far apart,
    // so the dots would swell up and overlap each other.
    //
    // It's also not divided by the zoom level. Dividing would keep the dots a
    // fixed size on screen, which sounds reasonable but actually defeats the
    // purpose: at fit-to-pane zoom the dots are already small enough to show only
    // the overall shape, and holding that size while zooming in fourteen times
    // reveals nothing more — just bare threads. Letting the zoom transform scale
    // both dots and lines keeps the ratio between dot size and level spacing
    // constant at every zoom level — zoom anywhere and you still get a readable graph.
    const n = tree.nodes.length
    return {
      box: {
        x: xMin - pad, y: yMin - pad,
        w: Math.max(xMax - xMin + pad * 2, 2),
        h: Math.max(yMax - yMin + pad * 2, 2),
      },
      dot: n > 500 ? 0.10 : n > 150 ? 0.16 : 0.26,
      line: n > 500 ? 0.05 : n > 150 ? 0.07 : 0.1,
    }
  }, [tree])

  // The drawing is split out and memoized: panning or zooming only changes one
  // transform attribute, without touching the hundreds of dots inside. Without
  // this, every mouse nudge would force React to rebuild the whole tree, and dragging would feel jerky.
  // Nodes sorted by the step that revealed them, computed once per result. The
  // visible set is then a prefix, so advancing the timeline is a slice rather
  // than a predicate run across every node ever expanded, once per frame, per
  // pane — which on a network of a few thousand nodes is the difference between
  // scanning them all three times a second and not.
  const byOrder = useMemo(() => (tree ? [...tree.nodes].sort((a, b) => a.order - b.order) : []), [tree])

  const body = useMemo(() => {
    if (!tree || !frame) return null
    const { dot, line } = frame
    // First index whose node has not been revealed yet — binary search, since
    // byOrder is sorted by exactly that field.
    let lo = 0, hi = byOrder.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (byOrder[mid].order < shown) lo = mid + 1
      else hi = mid
    }
    const visible = byOrder.slice(0, lo)
    return (
      <g strokeLinecap="round">
        {visible.map(t => {
          if (t.parent == null) return null
          const p = tree.nodes[tree.at.get(t.parent)!]
          if (!p || p.order >= shown) return null
          const both = onPath.has(t.idx) && onPath.has(t.parent)
          return (
            <line
              key={`e${t.idx}`}
              x1={p.x} y1={p.y} x2={t.x} y2={t.y}
              stroke={both ? ON_PATH : OPENED}
              strokeWidth={both ? line * 2.2 : line}
              opacity={both ? 1 : 0.42}
            />
          )
        })}
        {visible.map(t => {
          const current = t.order === shown - 1
          const path = onPath.has(t.idx)
          return (
            <circle
              key={`n${t.idx}`}
              cx={t.x} cy={t.y}
              r={current ? dot * 2.1 : path ? dot * 1.5 : dot}
              fill={current ? '#ffffff' : path ? ON_PATH : OPENED}
              stroke={current ? CURRENT : 'none'}
              strokeWidth={current ? dot * 0.9 : 0}
              opacity={current || path ? 1 : 0.72}
            />
          )
        })}
      </g>
    )
  }, [tree, byOrder, frame, onPath, shown])

  if (!result || !frame || !body)
    return <div className="tree-empty">Run the algorithm to see the search tree.</div>

  const { box } = frame
  // The zoom buttons zoom around the pane's center, not the coordinate origin —
  // if clicking zoom made the tree slide out of frame, the button would be unusable.
  const zoomBy = (factor: number) =>
    setCam(c => zoomAround(c, factor, { x: box.x + box.w / 2, y: box.y + box.h / 2 }))

  return (
    <div className="tree-wrap">
      <svg
        ref={svg}
        className="tree"
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={e => {
          const p = atCursor(e)
          drag.current = { x: p.x, y: p.y, cam }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          const p = atCursor(e)
          setCam({ ...d.cam, x: d.cam.x + (p.x - d.x), y: d.cam.y + (p.y - d.y) })
        }}
        onPointerUp={e => {
          drag.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onDoubleClick={() => setCam(HOME)}
      >
        <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>{body}</g>
      </svg>

      <div className="tree-zoom">
        <button onClick={() => zoomBy(1 / 1.5)} title="Zoom out">–</button>
        <span className="num">{cam.k < 10 ? cam.k.toFixed(1) : Math.round(cam.k)}×</span>
        <button onClick={() => zoomBy(1.5)} title="Zoom in">+</button>
        <button onClick={() => setCam(HOME)} title="Double-clicking the tree also returns here">Fit</button>
      </div>
    </div>
  )
}
