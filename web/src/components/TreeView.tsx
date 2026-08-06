import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildTree, type TreeNode } from '../lib/tree'
import type { Graph, RouteResult } from '../lib/types'

const OPENED = '#3b5bdb'
const CURRENT = '#16267a'
/** Text ink. Every number and letter in the diagram is drawn in this. */
const ON_PATH = '#23201b'
/** The branch that lies on the chosen route.
 *
 *  Amber rather than the ink it used to be: against a tree of blue nodes and
 *  black arithmetic, a black branch is the same weight as everything else and
 *  has to be traced rather than seen. A warm hue is the one thing on the pane
 *  nothing else uses, so the answer separates from the search at a glance. */
const PATH = '#f59e0b'
const PAPER = '#ffffff'
const MUTE = '#8b8578'

const MIN_ZOOM = 0.6
const MAX_ZOOM = 40

/** Radius of a node circle, in leaf-slot units. */
const R = 0.42
/**
 * How far apart sibling columns are pulled, as a multiple of a leaf slot.
 *
 * The layout hands out one slot per leaf, which is barely wider than a circle —
 * enough to read a shape, nowhere near enough for a line of arithmetic hanging
 * underneath one. Rather than pick a constant, the stretch is solved for: a pane
 * is about two and a half times as wide as it is tall, and a search tree is much
 * squarer than that, so fitting one inside the other leaves well over half the
 * pane empty and shrinks the numbers for no reason. Stretching horizontally
 * until the tree's proportions match the pane's spends that empty width on
 * legibility instead.
 *
 * The floor keeps the numbers from colliding on a tree wide enough not to need
 * the help; the ceiling stops a two-node tree from being pulled into a
 * horizontal line.
 */
const SPREAD_MIN_LETTERED = 2.6
const SPREAD_MIN_BARE = 0.8
const SPREAD_MAX_LETTERED = 7
const SPREAD_MAX_BARE = 4
/** Above this many nodes, lettering every node cannot be read at any zoom that
 *  still shows the tree's shape, so the diagram stops trying: it becomes bare
 *  circles, and the numbers arrive through the callout instead. */
const LETTERED_MAX = 80

interface Props {
  result: RouteResult | null
  step: number
  /** Supplies each node's letter. Only the sample graph has letters. */
  graph: Graph | null
  /** Names an intersection — a pinned place, or the streets that meet there. */
  nameOf: (nodeId: string) => string | undefined
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

/** Screen cursor coordinates, converted into the drawing frame's own units. */
function atCursorOf(el: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const ctm = el.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

/**
 * One algorithm's search tree, drawn as a layered node-link diagram.
 *
 * Depth runs downwards, siblings sit side by side, and every arrow points from
 * the node that was expanded to the node it led to — so "what did this node open
 * next" is answered the same way everywhere on screen. The branch that lies on
 * the final route is inked in black.
 *
 * The numbers are the point of the view, and they arrive through two channels
 * because no single one survives both sizes of graph. On a small network every
 * node is lettered and carries its own `g`/`h`/`f` underneath. On a network of a
 * few hundred nodes that is unreadable at any zoom that still shows the tree's
 * shape, so instead the node just expanded, the nodes it opened, and whatever
 * node is under the cursor get a callout drawn at a **fixed size on screen** —
 * counter-scaled against the camera, so it stays legible when the tree behind it
 * is a thumbnail. Shape and arithmetic are then both readable at once, rather
 * than the reader having to zoom in and lose the shape to get the numbers.
 *
 * Shares the timeline with the map: drag to a step and the tree grows to match.
 */
export function TreeView({ result, step, graph, nameOf }: Props) {
  const tree = useMemo(() => (result ? buildTree(result) : null), [result])
  // Written by the callback ref below, not handed to React directly, so it has
  // to be the mutable form rather than the read-only one `useRef<T>(null)` gives.
  const svg = useRef<SVGSVGElement | null>(null)
  const [cam, setCam] = useState<Camera>(HOME)
  /** The pane's size in pixels — both the stretch and the callout scale depend on it. */
  const [box, setBox] = useState({ w: 640, h: 260 })
  const [hover, setHover] = useState<number | null>(null)
  /** Tears down whatever is currently wired to the `<svg>`, if anything is. */
  const unwire = useRef<(() => void) | null>(null)
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null)

  // A new run means a completely different tree; keeping the old viewport would just leave you lost.
  useEffect(() => { setCam(HOME); setHover(null) }, [result])

  const lettered = !!tree && tree.nodes.length <= LETTERED_MAX

  const spread = useMemo(() => {
    const low = lettered ? SPREAD_MIN_LETTERED : SPREAD_MIN_BARE
    const high = lettered ? SPREAD_MAX_LETTERED : SPREAD_MAX_BARE
    if (!tree?.nodes.length) return low
    const [xMin, yMin, xMax, yMax] = tree.bounds
    const wide = xMax - xMin
    const tall = yMax - yMin
    // A single unbranched chain — DFS, most of the time — has no width to
    // stretch. Leaving it tall and thin is not a failure of the layout; that
    // shape is the whole portrait of the algorithm.
    if (wide < 0.001 || tall < 0.001) return low
    return Math.min(high, Math.max(low, (box.w / box.h) * (tall / wide)))
  }, [tree, lettered, box])

  const onPath = useMemo(() => {
    if (!result) return new Set<number>()
    const index = new Map(result.nodeIds.map((id, i) => [id, i]))
    return new Set(result.path.map(id => index.get(id)!).filter(i => i !== undefined))
  }, [result])

  /** The letter this node carries on the map, when the graph has letters at all. */
  const letterOf = useMemo(() => {
    if (!result || !graph) return () => undefined as string | undefined
    return (idx: number) => graph.nodes[result.nodeIds[idx]]?.label
  }, [result, graph])

  /** Looks a node up by index, the one place that walks `tree.at` to do it. */
  const nodeOf = (idx: number): TreeNode | undefined => {
    const pos = tree?.at.get(idx)
    return pos === undefined ? undefined : tree?.nodes[pos]
  }

  /** A node's screen position: its column stretched by the spread, its row as laid out. */
  const at = (t: TreeNode) => ({ x: t.x * spread, y: t.y })

  /** Convert screen cursor coordinates to coordinates inside the drawing frame. */
  const atCursor = (e: { clientX: number; clientY: number }) =>
    svg.current ? atCursorOf(svg.current, e) : { x: 0, y: 0 }

  /**
   * Wires the wheel listener and the size observer to whichever `<svg>` is
   * currently on screen.
   *
   * Both used to be mount-once effects reading `svg.current`, and both silently
   * stopped working on any pane whose tree went away and came back. The
   * component returns a placeholder whenever there is no result yet — before
   * the first run, and again after every setting that calls `clearResults` —
   * and on the way back React builds a *new* `<svg>` element. The effects never
   * re-ran, so the listener stayed bound to the old detached node: the tree
   * kept its zoom buttons but scrolling over it fell through to the browser,
   * which zoomed the whole page instead. The size observer failed the same way,
   * leaving the layout solved against a stale pane width.
   *
   * A callback ref cannot drift like that. React calls it with the element on
   * every mount and with null on every unmount, so the wiring is tied to the
   * element's actual lifetime rather than to the component's first render.
   *
   * The wheel listener is registered by hand rather than through `onWheel`
   * because React attaches wheel handlers as passive, and `preventDefault`
   * inside a passive listener does nothing — which is the same page-scroll the
   * bug above produced, just for a different reason.
   */
  const attachSvg = useCallback((el: SVGSVGElement | null) => {
    unwire.current?.()
    unwire.current = null
    svg.current = el
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = atCursorOf(el, e)
      // Keep the point under the cursor fixed — that's what the user is looking at.
      setCam(c => zoomAround(c, Math.exp(-e.deltaY * 0.0016), p))
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width && r.height) setBox({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)

    unwire.current = () => {
      el.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [])

  const shown = result ? Math.min(step, result.trace.length) : 0

  const frame = useMemo(() => {
    if (!tree?.nodes.length) return null
    const [xMin, yMin, xMax, yMax] = tree.bounds
    // Only as much margin as something actually hangs into: half a label's width
    // past the outermost column, the `#n` badge above the first row, and the line
    // of arithmetic under the last. Padding is charged twice — it eats the frame
    // and then shrinks everything drawn inside it — so a round two units on each
    // side was costing a third of the pane.
    const padX = lettered ? 1.6 : 1
    const padY = lettered ? 0.9 : 1
    return {
      x: xMin * spread - padX,
      y: yMin - padY,
      w: Math.max((xMax - xMin) * spread + padX * 2, 4),
      h: Math.max(yMax - yMin + padY * 2, 3),
    }
  }, [tree, spread, lettered])

  // Nodes sorted by the step that revealed them, computed once per result. The
  // visible set is then a prefix, so advancing the timeline is a slice rather
  // than a predicate run across every node ever expanded, once per frame, per
  // pane — which on a network of a few thousand nodes is the difference between
  // scanning them all three times a second and not.
  const byOrder = useMemo(() => (tree ? [...tree.nodes].sort((a, b) => a.order - b.order) : []), [tree])

  const visible = useMemo(() => {
    // First index whose node has not been revealed yet — binary search, since
    // byOrder is sorted by exactly that field.
    let lo = 0, hi = byOrder.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (byOrder[mid].order < shown) lo = mid + 1
      else hi = mid
    }
    return byOrder.slice(0, lo)
  }, [byOrder, shown])

  // `visible` is already the order-sorted prefix below `shown`, so the node
  // that was revealed last — if the last revealing step actually opened a new
  // node, rather than re-touching one already on the tree — is just its tail,
  // not a fresh scan of every node on every render.
  const lastVisible = visible[visible.length - 1]
  const current = lastVisible?.order === shown - 1 ? lastVisible : null

  // The drawing is split out and memoized: panning or zooming only changes one
  // transform attribute, without touching the hundreds of circles inside. Without
  // this, every mouse nudge would force React to rebuild the whole tree, and dragging would feel jerky.
  const body = useMemo(() => {
    if (!tree) return null
    const line = lettered ? 0.05 : 0.035

    return (
      <g strokeLinecap="round">
        {visible.map(t => {
          if (t.parent == null) return null
          const p = nodeOf(t.parent) ?? null
          if (!p || p.order >= shown) return null
          const both = onPath.has(t.idx) && onPath.has(t.parent)
          const a = at(p), b = at(t)
          const dx = b.x - a.x, dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len, uy = dy / len
          // Stop the line at the circle's rim, not its centre, so the arrowhead
          // sits against the node it points at instead of underneath it.
          const ex = b.x - ux * R, ey = b.y - uy * R
          const head = both ? 0.34 : 0.24
          const wing = head * 0.44
          return (
            <g key={`e${t.idx}`}>
              <line
                x1={a.x + ux * R} y1={a.y + uy * R} x2={ex} y2={ey}
                stroke={both ? PATH : OPENED}
                strokeWidth={both ? line * 2.6 : line}
                opacity={both ? 1 : 0.4}
              />
              {(lettered || both) && (
                <path
                  d={`M ${ex} ${ey} L ${ex - ux * head + -uy * wing} ${ey - uy * head + ux * wing} L ${ex - ux * head + uy * wing} ${ey - uy * head - ux * wing} Z`}
                  fill={both ? PATH : OPENED}
                  opacity={both ? 1 : 0.5}
                />
              )}
            </g>
          )
        })}

        {visible.map(t => {
          const isCurrent = t.order === shown - 1
          const path = onPath.has(t.idx)
          const c = at(t)
          return (
            <circle
              key={`n${t.idx}`}
              cx={c.x} cy={c.y}
              r={isCurrent ? R * 1.16 : R}
              fill={isCurrent ? PAPER : path ? PATH : lettered ? PAPER : OPENED}
              stroke={isCurrent ? CURRENT : path ? PATH : OPENED}
              strokeWidth={isCurrent ? R * 0.34 : lettered ? R * 0.2 : 0}
              opacity={isCurrent || path ? 1 : lettered ? 0.9 : 0.7}
              onPointerEnter={() => setHover(t.idx)}
              onPointerLeave={() => setHover(h => (h === t.idx ? null : h))}
            />
          )
        })}

        {lettered && visible.map(t => {
          const c = at(t)
          const letter = letterOf(t.idx)
          return (
            <g
              key={`t${t.idx}`}
              pointerEvents="none"
              textAnchor="middle"
              // A halo of paper painted behind each glyph. A node's arithmetic sits
              // in the gap its own children's edges run through, so on any branch
              // that goes straight down the line crosses the digits. `paint-order`
              // puts the stroke under the fill, which turns that stroke into a
              // backdrop rather than an outline around the letterforms.
              paintOrder="stroke"
              stroke={PAPER}
              strokeWidth={0.1}
              strokeLinejoin="round"
            >
              {/* Amber and paper are both light enough to take dark text, so every
                  node letter is inked the same — no per-state ink to keep in step. */}
              <text x={c.x} y={c.y + R * 0.36} fontSize={letter ? R * 1.05 : R * 0.78} fill={ON_PATH}>
                {letter ?? t.order + 1}
              </text>
              {/* Everything about the node on one line, directly under it.
                  The expansion order used to sit in a badge above the circle, and
                  on a tree of any depth that badge landed on the arithmetic of the
                  node in the row above — the two were about four hundredths of a
                  unit apart. Folding it into this line removes the collision
                  outright rather than buying clearance by spacing the rows further
                  apart, which would only have shrunk every number on screen. */}
              <text x={c.x} y={c.y + R + 0.4} fontSize={0.28} fill={ON_PATH} opacity={0.9}>
                <tspan fill={MUTE}>#{t.order + 1}</tspan>
                {/* A plain triple, with the key printed once in the corner of the
                    pane rather than a letter repeated in front of every number on
                    every node. A blind search has no `h`, and therefore no `f`
                    either — writing one would invent a heuristic it never
                    consulted — so it keeps its `g` named. */}
                {t.h === null
                  ? ` g ${t.g.toFixed(1)}`
                  : ` (${(t.g + t.h).toFixed(1)}, ${t.g.toFixed(1)}, ${t.h.toFixed(1)})`}
              </text>
            </g>
          )
        })}
      </g>
    )
  }, [tree, visible, onPath, shown, lettered, spread, letterOf])

  if (!result || !frame || !body)
    return <div className="tree-empty">Run the algorithm to see the search tree.</div>

  // Screen-constant sizing for the callout. `preserveAspectRatio="…meet"` fits
  // the frame inside the pane, so the viewBox's scale is whichever axis runs out
  // first; the camera then multiplies by `k`.
  const px = 1 / (Math.min(box.w / frame.w, box.h / frame.h) * cam.k)

  /** Who gets a callout: the node just expanded, the nodes it opened, and whatever is hovered. */
  const called: TreeNode[] = []
  if (!lettered && current) {
    called.push(current)
    for (const kid of tree?.kids.get(current.idx) ?? []) {
      const node = nodeOf(kid)
      if (node && node.order < shown) called.push(node)
    }
  }
  if (hover !== null) {
    const node = nodeOf(hover)
    if (node && node.order < shown && !called.some(c => c.idx === node.idx)) called.push(node)
  }

  const zoomBy = (factor: number) =>
    setCam(c => zoomAround(c, factor, { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }))

  /** Whether this algorithm consulted a heuristic — only then is there a triple to key. */
  const guided = lettered && tree.nodes.some(n => n.h !== null)

  return (
    <div className="tree-wrap">
      {guided && <div className="tree-key">(f, g, h)</div>}
      <svg
        ref={attachSvg}
        className="tree"
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
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
        <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
          {body}
          {called.map(t => (
            <Callout
              key={`c${t.idx}`}
              node={t}
              x={at(t).x}
              y={t.y}
              px={px}
              letter={letterOf(t.idx)}
              name={result.nodeIds[t.idx] ? nameOf(result.nodeIds[t.idx]) : undefined}
              lead={t.idx === current?.idx}
              // Hang it off whichever side has room. A node near the right edge
              // would otherwise put its numbers outside the pane, and the one
              // node whose numbers are wanted most is the one being expanded —
              // which on a goal-directed search is exactly the node nearest an edge.
              flip={at(t).x > frame.x + frame.w * 0.6}
            />
          ))}
        </g>
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

/**
 * One node's arithmetic, drawn at a fixed size on screen.
 *
 * Everything inside is measured in screen pixels and then scaled by `px`, which
 * is the reciprocal of the camera's total scale — so the box comes out the same
 * size whether the tree behind it is fit to the pane or zoomed in forty times.
 * That is the whole reason it exists: the tree's shape and one node's numbers
 * are wanted at the same moment, and they live at completely different scales.
 */
/** Longest name the box will carry. Past this it is wider than the tree behind it. */
const NAME_MAX = 30

function Callout(
  { node, x, y, px, letter, name, lead, flip }:
  {
    node: TreeNode; x: number; y: number; px: number
    letter?: string; name?: string; lead: boolean; flip: boolean
  },
) {
  const lines: { text: string; tone: 'quiet' | 'title' | 'number' }[] = [
    { text: `#${node.order + 1}${letter ? ` · ${letter}` : ''}`, tone: 'quiet' },
    // Where the node is, not just when it was reached. On an OpenStreetMap
    // network the expansion order is the only other thing there is to say about
    // a node, and it says nothing whatever about the city.
    ...(name
      ? [{
        text: name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name,
        tone: 'title' as const,
      }]
      : []),
    // f first: it is the number the frontier is actually ordered by, so it is
    // the one that explains why this node came up next. g and h are its parts.
    ...(node.h !== null ? [{ text: `f ${(node.g + node.h).toFixed(2)}`, tone: 'number' as const }] : []),
    { text: `g ${node.g.toFixed(2)}`, tone: 'number' },
    ...(node.h !== null ? [{ text: `h ${node.h.toFixed(2)}`, tone: 'number' as const }] : []),
  ]
  const size = 11
  const lead1 = 13
  const padding = 5
  const width = Math.max(...lines.map(l => l.text.length)) * size * 0.6 + padding * 2
  const height = lines.length * lead1 + padding * 2 - 3
  const left = flip ? -10 - width : 10

  return (
    <g transform={`translate(${x} ${y}) scale(${px})`} pointerEvents="none">
      <rect
        x={left} y={-height / 2} width={width} height={height} rx={3}
        fill={PAPER} stroke={lead ? CURRENT : OPENED} strokeWidth={lead ? 1.4 : 0.9}
        opacity={0.97}
      />
      {lines.map((l, i) => (
        <text
          key={l.text}
          x={left + padding}
          y={-height / 2 + padding + lead1 * i + size - 2}
          fontSize={size}
          fill={l.tone === 'quiet' ? MUTE : ON_PATH}
          fontWeight={l.tone === 'quiet' ? 400 : l.tone === 'title' ? 600 : 500}
        >
          {l.text}
        </text>
      ))}
    </g>
  )
}
