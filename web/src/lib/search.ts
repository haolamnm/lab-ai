import { haversine } from './geo'
import {
  costIsFlat, edgeCost, edgeMinutes, passable, PERIODS, ROAD_LABEL, turnAllowed, VEHICLES,
  vehicleOf,
  type Conditions,
} from './traffic'
import type { AlgoKey, Graph, GraphEdge, RouteResult, TraceStep } from './types'

/** Mỗi thuật toán mang một màu riêng để nhận ra màn hình nào là màn hình nào
 *  khi lưới có tới năm ô. Màu này chỉ xuất hiện ở viền và tiêu đề ô, không bao
 *  giờ vẽ lên bản đồ, nên không tranh nghĩa với thang kẹt xe hay vùng đã xét. */
export const ALGOS: { key: AlgoKey; name: string; optimal: boolean; note: string; hue: string }[] = [
  { key: 'bfs',      name: 'BFS',               optimal: false, hue: '#b0651c', note: 'Ít chặng nhất, bỏ qua chi phí' },
  { key: 'dfs',      name: 'DFS',               optimal: false, hue: '#a33b62', note: 'Đâm sâu một nhánh, đường thường tệ' },
  { key: 'ucs',      name: 'UCS',               optimal: true,  hue: '#1e5fa8', note: 'Tối ưu, mở rộng đều mọi hướng — chính là Dijkstra' },
  { key: 'astar',    name: 'A*',                optimal: true,  hue: '#0a736f', note: 'Tối ưu, mở ít nút hơn nhờ ước lượng' },
  { key: 'greedy',   name: 'Greedy Best-First', optimal: false, hue: '#6d4aa8', note: 'Mở rất ít nút, không đảm bảo tốt nhất' },
]
export const algoOf = (k: AlgoKey) => ALGOS.find(a => a.key === k)!

/* Bảng tra mã nút ↔ chỉ số, dựng một lần cho mỗi mạng lưới. */
const indexCache = new WeakMap<Graph, { ids: string[]; of: Record<string, number> }>()
function indexer(graph: Graph) {
  let hit = indexCache.get(graph)
  if (!hit) {
    const ids = Object.keys(graph.nodes)
    const of: Record<string, number> = {}
    ids.forEach((id, i) => (of[id] = i))
    hit = { ids, of }
    indexCache.set(graph, hit)
  }
  return hit
}

/** Hàng đợi ưu tiên nhị phân, xoá lười: phần tử cũ bị bỏ qua khi lấy ra. */
class Heap {
  private a: { id: string; p: number }[] = []
  get size() { return this.a.length }
  push(id: string, p: number) {
    this.a.push({ id, p })
    let i = this.a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.a[parent].p <= this.a[i].p) break
      ;[this.a[parent], this.a[i]] = [this.a[i], this.a[parent]]
      i = parent
    }
  }
  pop() {
    const top = this.a[0]
    const last = this.a.pop()!
    if (this.a.length) {
      this.a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < this.a.length && this.a[l].p < this.a[m].p) m = l
        if (r < this.a.length && this.a[r].p < this.a[m].p) m = r
        if (m === i) break
        ;[this.a[m], this.a[i]] = [this.a[i], this.a[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * Chi phí thấp nhất trên mỗi ki-lô-mét trong mạng lưới. Nhân với khoảng cách
 * đường chim bay cho ra cận dưới của chi phí thật, nên ước lượng vẫn không bao
 * giờ nói quá — nếu dùng thẳng số ki-lô-mét thì A* sẽ thoái hoá gần thành UCS
 * và mất luôn ý nghĩa so sánh.
 */
function minCostPerKm(graph: Graph, c: Conditions): number {
  let best = Infinity
  for (const e of graph.edges) {
    if (!passable(e, c.vehicle, c.period)) continue
    const v = edgeCost(e, c) / e.km
    if (v < best) best = v
  }
  return Number.isFinite(best) ? best : 0
}

interface Leg {
  path: string[]
  trace: TraceStep[]
  found: boolean
  ms: number
  /** Số lần phải bỏ một hướng đi vì gặp biển cấm rẽ. */
  turnsBlocked: number
}

function searchLeg(graph: Graph, algo: AlgoKey, start: string, goal: string, c: Conditions, k: number): Leg {
  const t0 = performance.now()
  const { of } = indexer(graph)
  const goalNode = graph.nodes[goal]
  const weighted = algo !== 'bfs' && algo !== 'dfs'
  const h = (id: string) => k * haversine(graph.nodes[id], goalNode)

  const parent: Record<string, string | null> = { [start]: null }
  // Đoạn đường đã dẫn tới mỗi nút. Cấm rẽ là ràng buộc trên cặp đoạn đường, nên
  // biết nút cha thôi chưa đủ — phải biết đi vào bằng đoạn nào.
  const via: Record<string, GraphEdge | null> = { [start]: null }
  let turnsBlocked = 0
  const g: Record<string, number> = { [start]: 0 }
  const closed = new Set<string>()
  const open = new Set<string>([start])
  const trace: TraceStep[] = []

  const stack: string[] = [start]
  const queue: string[] = [start]
  const heap = new Heap()
  const priority = (id: string) =>
    algo === 'greedy' ? h(id) : algo === 'astar' ? g[id] + h(id) : g[id]
  if (weighted) heap.push(start, priority(start))

  let found = false
  for (;;) {
    let cur: string | undefined
    if (algo === 'bfs') cur = queue.shift()
    else if (algo === 'dfs') cur = stack.pop()
    else {
      while (heap.size) {
        const top = heap.pop()
        if (!closed.has(top.id)) { cur = top.id; break }
      }
    }
    if (cur === undefined) break
    if (closed.has(cur)) continue
    closed.add(cur)
    open.delete(cur)

    trace.push({
      expanded: of[cur],
      frontier: [...open].map(id => of[id]),
      g: +(g[cur] ?? 0).toFixed(3),
      h: algo === 'astar' || algo === 'greedy' ? +h(cur).toFixed(3) : null,
      parent: parent[cur] == null ? null : of[parent[cur]!],
    })
    if (cur === goal) { found = true; break }

    const inEdge = via[cur] ?? null
    for (const e of graph.adj[cur] ?? []) {
      if (!passable(e, c.vehicle, c.period) || closed.has(e.to)) continue
      if (inEdge && !turnAllowed(graph.turns, cur, inEdge, e, c)) { turnsBlocked++; continue }
      const step = weighted ? edgeCost(e, c) : 1
      const tentative = (g[cur] ?? 0) + step

      if (algo === 'dfs') {
        // DFS phải bám cây duyệt của chính nó, không nhận cha tốt hơn từ nhánh khác.
        if (e.to in g) continue
        g[e.to] = tentative; parent[e.to] = cur; via[e.to] = e
        stack.push(e.to); open.add(e.to)
      } else if (algo === 'bfs') {
        if (e.to in g) continue
        g[e.to] = tentative; parent[e.to] = cur; via[e.to] = e
        queue.push(e.to); open.add(e.to)
      } else {
        if (e.to in g && tentative >= g[e.to]) continue
        g[e.to] = tentative; parent[e.to] = cur; via[e.to] = e
        heap.push(e.to, priority(e.to)); open.add(e.to)
      }
    }
  }

  const path: string[] = []
  if (found) { let cur: string | null = goal; while (cur) { path.unshift(cur); cur = parent[cur] } }
  return { path, trace, found, turnsBlocked, ms: performance.now() - t0 }
}

function edgeBetween(graph: Graph, a: string, b: string): GraphEdge | undefined {
  return graph.adj[a]?.find(e => e.to === b)
}

/** Có đường nào từ a tới b nếu chỉ được đi trên những đoạn thoả `allow` không. */
function reaches(graph: Graph, a: string, b: string, allow: (e: GraphEdge) => boolean): boolean {
  const seen = new Set([a])
  const queue = [a]
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]
    if (cur === b) return true
    for (const e of graph.adj[cur] ?? [])
      if (allow(e) && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
  }
  return seen.has(b)
}

/**
 * Vì sao chặng này không có đường đi.
 *
 * "Không tới được" mà đứng một mình thì người dùng chỉ biết là hỏng, không biết
 * phải làm gì tiếp. Hai nguyên nhân dẫn tới nó lại đòi hai cách xử lý trái
 * ngược nhau: mạng lưới đứt đoạn thì phải dựng lại, còn loại xe bị cấm thì mạng
 * lưới vẫn tốt, chỉ cần đổi xe. Phân biệt được hai trường hợp ấy chỉ tốn hai
 * lượt duyệt theo chiều rộng, nên cứ nói thẳng ra.
 */
function whyBlocked(graph: Graph, from: string, to: string, c: Conditions): string {
  if (!reaches(graph, from, to, () => true)) {
    // Có đường mà không đi được thì là ngược chiều, không phải đứt đoạn — hai
    // chuyện ấy sửa bằng hai cách khác nhau nên không được gộp làm một.
    const back: Record<string, string[]> = {}
    for (const e of graph.edges) (back[e.to] ??= []).push(e.from)
    const seen = new Set([from])
    const queue = [from]
    for (let head = 0; head < queue.length; head++) {
      for (const e of graph.adj[queue[head]] ?? []) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
      for (const f of back[queue[head]] ?? []) if (!seen.has(f)) { seen.add(f); queue.push(f) }
    }
    if (seen.has(to))
      return 'Hai điểm có đường nối nhưng toàn đường một chiều ngược hướng, đi xuôi chiều thì không tới được. '
           + 'Bấm "Dựng lại mạng lưới" ở mức chi tiết cao hơn để có thêm đường vòng.'

    return 'Mạng lưới đang đứt đoạn giữa hai điểm: ở mức chi tiết này không có đoạn đường nào nối chúng lại. '
         + 'Bấm "Dựng lại mạng lưới" ở mức chi tiết khác, hoặc chọn hai điểm gần nhau hơn.'
  }

  const me = vehicleOf(c.vehicle)

  // Cùng loại xe nhưng khung giờ khác mà đi được thì thủ phạm là giờ cấm tải,
  // không phải bản thân chiếc xe — và cách sửa là đổi giờ, không phải đổi xe.
  const freeAt = PERIODS.filter(p => p.key !== c.period
    && reaches(graph, from, to, e => passable(e, c.vehicle, p.key)))
  if (freeAt.length && me.curfew)
    return `${me.curfew.note}. Mọi đường nối hai điểm đều đi qua `
         + `${me.curfew.classes.map(r => ROAD_LABEL[r]).join(' hoặc ')}, nên lúc này ${me.name.toLowerCase()} không qua được. `
         + `Chuyển sang khung ${freeAt.map(p => p.name.toLowerCase()).join(' hoặc ')} thì đi được.`

  const others = VEHICLES.filter(v => v.key !== c.vehicle && reaches(graph, from, to, e => passable(e, v.key, c.period)))
  const banned = me.banned.map(r => ROAD_LABEL[r]).join(' và ') || 'đường bị cấm'

  if (!others.length)
    return `Mọi đường nối hai điểm đều đi qua ${banned} — không loại xe nào trong danh sách đi được. `
         + 'Dựng lại mạng lưới ở mức chi tiết cao hơn để có thêm đường nhỏ.'

  return `${me.name} không qua được: mọi đường nối hai điểm đều phải đi qua ${banned}, mà ${me.name.toLowerCase()} bị cấm ở đó. `
       + `Đổi sang ${others.map(v => v.name.toLowerCase()).join(' hoặc ')} thì đi được.`
}

function statsOf(graph: Graph, path: string[], c: Conditions) {
  let km = 0, minutes = 0, cost = 0
  for (let i = 0; i + 1 < path.length; i++) {
    const e = edgeBetween(graph, path[i], path[i + 1])
    if (!e) continue
    km += e.km; minutes += edgeMinutes(e, c); cost += edgeCost(e, c)
  }
  return { km, minutes, cost }
}

/** Sắp thứ tự ghé bằng láng giềng gần nhất, đo bằng chi phí thật chứ không phải đường chim bay. */
function orderStops(graph: Graph, start: string, stops: string[], c: Conditions, k: number): string[] {
  const cache = new Map<string, number>()
  const costBetween = (a: string, b: string) => {
    const key = `${a}>${b}`
    if (!cache.has(key)) {
      const leg = searchLeg(graph, 'ucs', a, b, c, k)
      cache.set(key, leg.found ? statsOf(graph, leg.path, c).cost : Infinity)
    }
    return cache.get(key)!
  }
  const left = [...stops], order: string[] = []
  let cur = start
  while (left.length) {
    let bi = 0
    for (let i = 1; i < left.length; i++)
      if (costBetween(cur, left[i]) < costBetween(cur, left[bi])) bi = i
    cur = left[bi]; order.push(cur); left.splice(bi, 1)
  }
  return order
}

export interface PlanInput {
  graph: Graph
  algo: AlgoKey
  start: string
  goal: string
  stops: string[]
  optimiseOrder: boolean
  conditions: Conditions
}

/**
 * Chạy một thuật toán qua cả hành trình. Nhiều điểm dừng thì chạy lần lượt
 * từng chặng rồi nối các bước lại thành một dòng thời gian duy nhất, để mọi
 * màn hình so sánh được với nhau trên cùng một thanh thời gian.
 */
export function planRoute(input: PlanInput): RouteResult {
  const { graph, algo, start, goal, stops, optimiseOrder, conditions } = input
  const k = minCostPerKm(graph, conditions)
  const ordered = optimiseOrder && stops.length > 1 ? orderStops(graph, start, stops, conditions, k) : [...stops]
  const seq = [start, ...ordered, goal].filter((v, i, a) => i === 0 || v !== a[i - 1])

  // Hai địa chỉ khác nhau vẫn có thể ghim vào cùng một nút giao — hai đầu một
  // con hẻm chẳng hạn. Khi đó chuỗi chặng rút còn một phần tử và vòng lặp bên
  // dưới không chạy lần nào; nếu cứ thế trả về thì giao diện hiện "xong ở bước
  // 0, tối ưu", trông y như ứng dụng bị treo. Nói thẳng ra là hơn.
  if (seq.length < 2) return {
    algo, order: seq, path: [], trace: [], reveal: [], found: false,
    problem: 'Điểm lấy hàng và điểm giao cùng ghim vào một nút giao. Chọn hai điểm xa nhau hơn, hoặc tăng mức chi tiết mạng lưới.',
    nodeIds: indexer(graph).ids,
    metrics: { km: 0, minutes: 0, cost: 0, expanded: 0, ms: 0, optimal: false, turnsBlocked: 0 },
  }

  const trace: TraceStep[] = []
  const reveal: { upto: number; path: string[] }[] = []
  const path: string[] = []
  let km = 0, minutes = 0, cost = 0, ms = 0, turnsBlocked = 0, found = true
  let problem: string | undefined
  // Tới được tới điểm thứ mấy trong hành trình. Chặng nào hỏng thì những điểm
  // sau nó chưa hề được ghé, liệt kê chúng vào thứ tự ghé là nói sai sự thật.
  let reached = 1

  for (let i = 0; i + 1 < seq.length; i++) {
    const leg = searchLeg(graph, algo, seq[i], seq[i + 1], conditions, k)
    ms += leg.ms
    turnsBlocked += leg.turnsBlocked
    const reachedAt = leg.trace.length
    trace.push(...leg.trace)
    if (!leg.found) {
      found = false
      problem = whyBlocked(graph, seq[i], seq[i + 1], conditions)
      if (seq.length > 2) problem = `Chặng ${i + 1}/${seq.length - 1} bị tắc. ${problem}`
      break
    }

    const s = statsOf(graph, leg.path, conditions)
    km += s.km; minutes += s.minutes; cost += s.cost
    path.push(...(path.length ? leg.path.slice(1) : leg.path))
    reveal.push({ upto: trace.length - leg.trace.length + reachedAt, path: [...path] })
    reached = i + 2
  }

  return {
    algo, order: seq.slice(0, reached), path, trace, reveal, found, problem,
    nodeIds: indexer(graph).ids,
    metrics: {
      km: +km.toFixed(2),
      minutes: Math.round(minutes),
      cost: +cost.toFixed(1),
      expanded: trace.length,
      ms: +ms.toFixed(1),
      turnsBlocked,
      // Không có tuyến thì không có gì để tối ưu. Trước đây chỗ này chỉ đọc tính
      // chất lý thuyết của thuật toán nên vẫn đóng dấu "TỐI ƯU" lên một kết quả
      // rỗng, bên cạnh dòng "không tới được" ngay phía trên.
      //
      // Cấm rẽ cố tình KHÔNG tính vào đây, dù nó có làm suy yếu tính tối ưu.
      // Đo trên mạng lưới thật thì lượt chạy nào cũng gặp ít nhất một biển cấm
      // rẽ ở đâu đó, nên gộp vào là mọi kết quả đều thành "xấp xỉ" và cột này
      // mất sạch khả năng phân biệt UCS với Greedy — đúng thứ nó sinh ra để nói.
      // Mức độ ảnh hưởng nói riêng ở khối giải thích, kèm số lần bị chặn.
      // Trọng số phẳng thì mọi tuyến đều chi phí 0, nên "tối ưu" tuy đúng về
      // mặt toán học nhưng không còn nói lên điều gì — đừng đóng dấu nữa.
      optimal: found && algoOf(algo).optimal && stops.length === 0 && !costIsFlat(conditions.weights),
    },
  }
}
