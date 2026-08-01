import type { RouteResult } from './types'

/**
 * Lays the search tree out on the plane in a radial layout.
 *
 * Every expanded node has a parent — the node that led to it. That set of
 * parent-child pairs is a genuine tree, and **the shape of the tree is a
 * portrait of the algorithm**: DFS produces one long, almost unbranched
 * chain; BFS produces a fan spreading evenly layer by layer; A* produces a
 * teardrop shape skewed hard toward the goal; Greedy produces a single thin
 * branch. Put four trees side by side and the difference is obvious without
 * a word of explanation.
 *
 * This uses a radial layout by depth rather than a force-directed
 * simulation: the result is computed once and stays identical across runs,
 * so comparisons stay meaningful, and it costs no physics loop per frame.
 */

export interface TreeNode {
  /** Node index into RouteResult.nodeIds. */
  idx: number
  /** The step at which this node was expanded — used to reveal it progressively along the timeline. */
  order: number
  depth: number
  x: number
  y: number
  parent: number | null
}

export interface Tree {
  nodes: TreeNode[]
  /** Looks up array position in nodes from node index. */
  at: Map<number, number>
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
    // duplicate in `nodes` — skewing the fan angle of every ancestor along
    // with it.
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

  // Count each branch's leaves so the angle is divided fairly.
  const leaves = new Map<number, number>()
  const countLeaves = (n: number): number => {
    const c = kids.get(n)
    if (!c || !c.length) { leaves.set(n, 1); return 1 }
    const total = c.reduce((s, k) => s + countLeaves(k), 0)
    leaves.set(n, total)
    return total
  }
  const totalLeaves = roots.reduce((s, r) => s + countLeaves(r), 0) || 1

  const nodes: TreeNode[] = []
  const at = new Map<number, number>()
  let maxDepth = 0

  // Walk with an explicit stack: a DFS tree can run hundreds of levels
  // deep, and recursion there would overflow the call stack.
  const stack: { n: number; depth: number; from: number; span: number }[] = []
  let cursor = 0
  for (const r of roots) {
    const span = (leaves.get(r) ?? 1) / totalLeaves
    stack.push({ n: r, depth: 0, from: cursor, span })
    cursor += span
  }

  while (stack.length) {
    const { n, depth, from, span } = stack.pop()!
    const angle = (from + span / 2) * Math.PI * 2 - Math.PI / 2
    const radius = depth
    maxDepth = Math.max(maxDepth, depth)
    at.set(n, nodes.length)
    nodes.push({
      idx: n,
      order: orderOf.get(n) ?? 0,
      depth,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      parent: parentOf.get(n) ?? null,
    })

    let acc = from
    for (const k of kids.get(n) ?? []) {
      const kSpan = span * ((leaves.get(k) ?? 1) / (leaves.get(n) ?? 1))
      stack.push({ n: k, depth: depth + 1, from: acc, span: kSpan })
      acc += kSpan
    }
  }

  // A radial tree rarely fills the whole circle — branches bunching toward
  // one side is normal, especially for A*. Use a tight bounding box instead
  // of a radius-based square so the tree fills the pane instead of huddling
  // in the middle of empty space.
  let xMin = 0, yMin = 0, xMax = 0, yMax = 0
  for (const n of nodes) {
    if (n.x < xMin) xMin = n.x
    if (n.x > xMax) xMax = n.x
    if (n.y < yMin) yMin = n.y
    if (n.y > yMax) yMax = n.y
  }

  return { nodes, at, maxDepth, bounds: [xMin, yMin, xMax, yMax] }
}
