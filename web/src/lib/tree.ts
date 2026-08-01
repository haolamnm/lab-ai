import type { RouteResult } from './types'

/**
 * Trải cây tìm kiếm ra mặt phẳng theo kiểu toả tròn.
 *
 * Mỗi nút được mở đều có một nút cha — nút đã dẫn tới nó. Tập các cặp cha–con
 * ấy là một cây thật sự, và **hình dạng của cây chính là chân dung của thuật
 * toán**: DFS ra một chuỗi dài gần như không phân nhánh, BFS ra hình quạt toả
 * đều theo lớp, A* ra hình giọt nước lệch hẳn về phía đích, Greedy ra một nhánh
 * gầy. Đặt bốn cây cạnh nhau là hiểu ngay khác biệt, không cần lời nào.
 *
 * Dùng bố cục toả tròn theo độ sâu chứ không dùng mô phỏng lực đẩy: kết quả
 * tính một lần là xong, luôn giống nhau giữa các lần chạy nên so sánh mới có
 * nghĩa, và không tốn một vòng lặp vật lý nào mỗi khung hình.
 */

export interface TreeNode {
  /** Chỉ số nút trong RouteResult.nodeIds. */
  idx: number
  /** Bước mà nút này được mở — dùng để hiện dần theo dòng thời gian. */
  order: number
  depth: number
  x: number
  y: number
  parent: number | null
}

export interface Tree {
  nodes: TreeNode[]
  /** Tra từ chỉ số nút sang vị trí trong mảng nodes. */
  at: Map<number, number>
  maxDepth: number
  /** Khung bao khít quanh các nút: [xMin, yMin, xMax, yMax]. */
  bounds: [number, number, number, number]
}

export function buildTree(result: RouteResult): Tree {
  const trace = result.trace
  const orderOf = new Map<number, number>()
  trace.forEach((s, i) => { if (!orderOf.has(s.expanded)) orderOf.set(s.expanded, i) })

  // Cha phải là nút đã được mở trước đó; nếu không thì nút này tự làm gốc.
  // Hành trình nhiều chặng nối nhiều lượt chạy lại nên có nhiều gốc là bình thường.
  const kids = new Map<number, number[]>()
  const roots: number[] = []
  const parentOf = new Map<number, number | null>()

  trace.forEach((s, i) => {
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

  // Đếm số lá của mỗi nhánh để chia góc cho công bằng.
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

  // Duyệt bằng ngăn xếp tường minh: cây của DFS sâu tới hàng trăm tầng, đệ quy
  // ở đó là tràn ngăn xếp.
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

  // Cây toả tròn hiếm khi phủ kín hình tròn — nhánh dồn về một phía là chuyện
  // thường, nhất là với A*. Lấy khung bao khít thay vì hình vuông theo bán kính
  // để cây choán hết ô thay vì nằm co lại giữa một vùng trống.
  let xMin = 0, yMin = 0, xMax = 0, yMax = 0
  for (const n of nodes) {
    if (n.x < xMin) xMin = n.x
    if (n.x > xMax) xMax = n.x
    if (n.y < yMin) yMin = n.y
    if (n.y > yMax) yMax = n.y
  }

  return { nodes, at, maxDepth, bounds: [xMin, yMin, xMax, yMax] }
}
