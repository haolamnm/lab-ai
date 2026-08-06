import type { RouteResult } from './types'

/**
 * Lays the search tree out as a layered diagram: depth downwards, siblings
 * side by side.
 *
 * Every expanded node has a parent — the node that led to it. That set of
 * parent-child pairs is a genuine tree, and **the shape of the tree is a
 * portrait of the algorithm**: DFS produces one long, almost unbranched
 * chain; BFS produces a fan spreading evenly layer by layer; A* produces a
 * teardrop shape skewed hard toward the goal. Put the trees side by side and
 * the difference is obvious without a word of explanation.
 *
 * The layout was radial until it became clear that radial hides the two things
 * a reader actually wants. Depth was the radius, and nobody reads a radius —
 * level four and level five look alike. Worse, an arrow from parent to child
 * pointed in an arbitrary direction, so "which node did this one lead to" had
 * no consistent answer anywhere on screen. Laying depth out as rows fixes both:
 * depth is a row, every arrow points down, and the diagram reads top to bottom
 * like any other search tree.
 *
 * This is the classic tidy layout — leaves take consecutive slots, a parent
 * centres over its children — not a force-directed simulation: the result is
 * computed once and stays identical across runs, so comparisons stay
 * meaningful, and it costs no physics loop per frame.
 */

/**
 * Vertical distance between one depth and the next, in leaf-slot widths.
 *
 * Kept tight on purpose. A pane is roughly twice as wide as it is tall, so
 * height is the scarce dimension: every unit of vertical spacing costs more
 * on-screen size than a unit of horizontal spacing does. Room for one line of
 * arithmetic under each node is all this needs to buy.
 */
export const LEVEL_GAP = 1.8

export interface TreeNode {
  /** Node index into RouteResult.nodeIds. */
  idx: number
  /** The step at which this node was expanded — used to reveal it progressively along the timeline. */
  order: number
  depth: number
  x: number
  y: number
  parent: number | null
  /** Cost of the route that reached this node, as of the step that expanded it. */
  g: number
  /** Heuristic estimate at that step, or null for the blind searches (BFS/DFS/UCS). */
  h: number | null
}

export interface Tree {
  nodes: TreeNode[]
  /** Looks up array position in nodes from node index. */
  at: Map<number, number>
  /** Children of each node, in expansion order — the arrows out of it. */
  kids: Map<number, number[]>
  maxDepth: number
  /** Tight bounding box around the nodes: [xMin, yMin, xMax, yMax]. */
  bounds: [number, number, number, number]
}

export function buildTree(result: RouteResult): Tree {
  const trace = result.trace
  const orderOf = new Map<number, number>()
  trace.forEach((s, i) => { if (!orderOf.has(s.expanded)) orderOf.set(s.expanded, i) })

  // A parent must be a node that was already expanded; otherwise this node
  // becomes a root of its own. A multi-leg trip chains several runs
  // together, so having more than one root is expected.
  const kids = new Map<number, number[]>()
  const roots: number[] = []
  const parentOf = new Map<number, number | null>()

  trace.forEach((s, i) => {
    // Only accept the first expansion, matching orderOf above. A trip with
    // several stops chains independent runs together, so an intersection
    // sitting between two consecutive legs gets expanded once per leg, each
    // time with a different parent. Accepting both would put that node into
    // the kids of both parents, walking it twice and producing a ghost
    // duplicate in `nodes` — which in a tidy layout would hand the same node
    // two different columns.
    if (orderOf.get(s.expanded) !== i) return
    const p = s.parent
    const valid = p != null && orderOf.has(p) && orderOf.get(p)! < i
    parentOf.set(s.expanded, valid ? p! : null)
    if (valid) {
      if (!kids.has(p!)) kids.set(p!, [])
      kids.get(p!)!.push(s.expanded)
    } else {
      roots.push(s.expanded)
    }
  })

  // Walk with an explicit stack: a DFS tree can run hundreds of levels deep,
  // and recursion there would overflow the call stack. Two passes are folded
  // into the one walk — depth is known on the way down, but a parent's column
  // is the midpoint of its children's, so it can only be set on the way back up.
  const depthOf = new Map<number, number>()
  const xOf = new Map<number, number>()
  let maxDepth = 0
  let slot = 0

  for (const root of roots) {
    depthOf.set(root, 0)
    const stack: { n: number; up: boolean }[] = [{ n: root, up: false }]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const children = kids.get(frame.n) ?? []
      if (!frame.up) {
        frame.up = true
        const depth = depthOf.get(frame.n)!
        if (depth > maxDepth) maxDepth = depth
        // Pushed in reverse so the first child ends up on top of the stack and
        // therefore takes the leftmost slot — the tree reads in expansion order.
        for (let i = children.length - 1; i >= 0; i--) {
          depthOf.set(children[i], depth + 1)
          stack.push({ n: children[i], up: false })
        }
        continue
      }
      stack.pop()
      if (!children.length) {
        xOf.set(frame.n, slot)
        slot += 1
      } else {
        const first = xOf.get(children[0])!
        const last = xOf.get(children[children.length - 1])!
        xOf.set(frame.n, (first + last) / 2)
      }
    }
    // A blank column between two roots, so the legs of a multi-stop trip read
    // as separate trees rather than one tree with a strangely wide fork.
    slot += 1
  }

  const nodes: TreeNode[] = []
  const at = new Map<number, number>()
  for (const [idx, depth] of depthOf) {
    const step = orderOf.get(idx) ?? 0
    at.set(idx, nodes.length)
    nodes.push({
      idx,
      order: step,
      depth,
      x: xOf.get(idx) ?? 0,
      y: depth * LEVEL_GAP,
      parent: parentOf.get(idx) ?? null,
      g: trace[step]?.g ?? 0,
      h: trace[step]?.h ?? null,
    })
  }

  let xMin = 0, yMin = 0, xMax = 0, yMax = 0
  for (const n of nodes) {
    if (n.x < xMin) xMin = n.x
    if (n.x > xMax) xMax = n.x
    if (n.y < yMin) yMin = n.y
    if (n.y > yMax) yMax = n.y
  }

  return { nodes, at, kids, maxDepth, bounds: [xMin, yMin, xMax, yMax] }
}
