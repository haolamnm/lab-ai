import { haversine } from './geo'
import type { Graph, GraphEdge, GraphNode, RoadClass } from './types'

/**
 * Đồ thị mẫu do nhóm tự thiết kế.
 *
 * Đề bài tách riêng phần giảng giải thuật toán và yêu cầu nhóm **tự dựng ví dụ
 * minh hoạ, không chép từ tutorial**. Mạng lưới tải từ OpenStreetMap không dùng
 * cho việc đó được: hàng trăm tới hàng nghìn nút, mã nút là chuỗi toạ độ, không
 * ai dò bằng mắt nổi. Ví dụ giảng giải cần đúng thứ ngược lại — nhỏ, đặt tên,
 * kiểm soát được.
 *
 * Hai mươi nút mang tên hai mươi địa điểm có thật ở TP.HCM, mỗi nút gắn một chữ
 * cái để nói được "tuyến A → C → F → H" đúng như đoạn văn mẫu trong đề. Ba mươi
 * tư cạnh, vượt mức tối thiểu hai mươi nút ba mươi cạnh mà đề đặt ra, nên bộ dữ
 * liệu này nộp kèm được luôn.
 *
 * Các con số không đặt ngẫu nhiên. Chúng được chọn để bốn thuật toán ra bốn kết
 * quả khác nhau rõ rệt: có một tuyến ngắn nhưng chui qua cụm kẹt nặng ở Hàng
 * Xanh, một tuyến dài hơn nhưng thoáng chạy vòng qua Landmark 81, và vài nhánh
 * cụt về phía tây để DFS có chỗ đâm sâu rồi phải quay lui.
 */

interface Row {
  label: string
  name: string
  lat: number
  lng: number
}

const NODES: Row[] = [
  { label: 'A', name: 'Chợ Bến Thành',        lat: 10.7725, lng: 106.6980 },
  { label: 'B', name: 'Nhà thờ Đức Bà',       lat: 10.7797, lng: 106.6990 },
  { label: 'C', name: 'Dinh Độc Lập',         lat: 10.7772, lng: 106.6957 },
  { label: 'D', name: 'Bến Bạch Đằng',        lat: 10.7745, lng: 106.7060 },
  { label: 'E', name: 'Thảo Cầm Viên',        lat: 10.7880, lng: 106.7050 },
  { label: 'F', name: 'Ngã tư Hàng Xanh',     lat: 10.8010, lng: 106.7100 },
  { label: 'G', name: 'Landmark 81',          lat: 10.7947, lng: 106.7218 },
  { label: 'H', name: 'Cầu Sài Gòn',          lat: 10.7960, lng: 106.7280 },
  { label: 'I', name: 'Thảo Điền',            lat: 10.8060, lng: 106.7370 },
  { label: 'J', name: 'Chợ Thủ Đức',          lat: 10.8500, lng: 106.7550 },
  { label: 'K', name: 'Bến xe Miền Đông',     lat: 10.8145, lng: 106.7115 },
  { label: 'L', name: 'Chợ Bà Chiểu',         lat: 10.8018, lng: 106.6968 },
  { label: 'M', name: 'Sân bay Tân Sơn Nhất', lat: 10.8188, lng: 106.6520 },
  { label: 'N', name: 'Chợ Tân Bình',         lat: 10.7936, lng: 106.6473 },
  { label: 'O', name: 'ĐH Bách Khoa',         lat: 10.7725, lng: 106.6580 },
  { label: 'P', name: 'Bệnh viện Chợ Rẫy',    lat: 10.7556, lng: 106.6595 },
  { label: 'Q', name: 'Chợ Bình Tây',         lat: 10.7500, lng: 106.6500 },
  { label: 'R', name: 'Công viên Đầm Sen',    lat: 10.7680, lng: 106.6350 },
  { label: 'S', name: 'Cầu Chữ Y',            lat: 10.7480, lng: 106.6870 },
  { label: 'T', name: 'Crescent Mall Q7',     lat: 10.7290, lng: 106.7180 },
]

/** [từ, đến, km, mức kẹt xe 1-5, rủi ro 0-1, cấp đường] */
const EDGES: [string, string, number, number, number, RoadClass][] = [
  ['A', 'C', 0.7, 4, 0.10, 'secondary'],
  ['A', 'D', 1.0, 3, 0.10, 'primary'],
  ['A', 'S', 3.2, 3, 0.30, 'secondary'],
  ['A', 'O', 4.4, 4, 0.20, 'primary'],
  ['B', 'C', 0.5, 2, 0.05, 'tertiary'],
  ['B', 'D', 1.0, 2, 0.05, 'tertiary'],
  ['B', 'E', 1.1, 3, 0.10, 'secondary'],
  ['C', 'L', 3.0, 4, 0.20, 'primary'],
  ['D', 'E', 1.6, 2, 0.10, 'primary'],
  ['D', 'T', 5.6, 3, 0.20, 'primary'],
  ['E', 'F', 1.6, 5, 0.40, 'primary'],
  ['E', 'G', 2.1, 3, 0.10, 'primary'],
  ['F', 'G', 1.5, 5, 0.50, 'primary'],
  ['F', 'K', 2.0, 4, 0.30, 'primary'],
  ['F', 'L', 1.5, 4, 0.30, 'secondary'],
  ['G', 'H', 0.8, 3, 0.10, 'primary'],
  ['H', 'I', 1.4, 2, 0.10, 'motorway'],
  ['H', 'K', 2.4, 3, 0.20, 'primary'],
  ['I', 'J', 5.5, 2, 0.10, 'motorway'],
  ['J', 'K', 5.2, 3, 0.20, 'primary'],
  ['K', 'M', 6.5, 4, 0.30, 'primary'],
  ['L', 'M', 5.3, 4, 0.30, 'secondary'],
  ['L', 'N', 5.6, 3, 0.20, 'secondary'],
  ['M', 'N', 3.0, 3, 0.20, 'primary'],
  ['N', 'O', 2.7, 3, 0.20, 'secondary'],
  ['N', 'R', 3.5, 2, 0.10, 'tertiary'],
  ['O', 'P', 2.0, 4, 0.30, 'secondary'],
  ['O', 'R', 2.6, 3, 0.20, 'tertiary'],
  ['P', 'Q', 1.8, 5, 0.50, 'residential'],
  ['P', 'S', 2.2, 4, 0.40, 'secondary'],
  ['Q', 'R', 2.4, 3, 0.20, 'residential'],
  ['Q', 'S', 4.3, 3, 0.30, 'secondary'],
  ['S', 'T', 4.0, 2, 0.10, 'primary'],
  ['T', 'H', 6.0, 2, 0.10, 'motorway'],
]

export const SAMPLE_NODE_COUNT = NODES.length
export const SAMPLE_EDGE_COUNT = EDGES.length

/** Nút mặc định khi nạp đồ thị mẫu: từ chợ Bến Thành ra chợ Thủ Đức. */
export const SAMPLE_START = 'A'
export const SAMPLE_GOAL = 'J'

export function buildSampleGraph(): Graph {
  const byLabel = new Map(NODES.map(r => [r.label, r]))
  const nodes: Record<string, GraphNode> = {}
  for (const r of NODES) nodes[r.label] = { id: r.label, lat: r.lat, lng: r.lng, label: r.label, name: r.name }

  const edges: GraphEdge[] = []
  for (const [from, to, km, congestion, risk, roadClass] of EDGES) {
    const a = byLabel.get(from)!, b = byLabel.get(to)!
    const shape: [number, number][] = [[a.lat, a.lng], [b.lat, b.lng]]
    // Tên cạnh dùng luôn cặp chữ cái, để lời giải thích đọc lên giống hệt đoạn
    // văn mẫu của đề: "đoạn E–F đang kẹt 5/5".
    const name = `${from}–${to}`
    edges.push({ from, to, km, roadClass, congestion, risk, name, shape })
    edges.push({ from: to, to: from, km, roadClass, congestion, risk, name, shape: [...shape].reverse() })
  }

  const adj: Record<string, GraphEdge[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  for (const e of edges) adj[e.from].push(e)

  const lats = NODES.map(n => n.lat), lngs = NODES.map(n => n.lng)
  return {
    nodes, edges, adj, detail: 'coarse',
    bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
  }
}

/** Địa điểm của một nút mẫu, để đưa thẳng vào ô chọn điểm đi và điểm đến. */
export function samplePlace(label: string) {
  const r = NODES.find(n => n.label === label)!
  return { name: `${r.label} · ${r.name}`, detail: 'Đồ thị mẫu', lat: r.lat, lng: r.lng }
}

/** Kiểm tra nhanh: đồ thị có liền mạch không, và có đủ kích thước đề yêu cầu không. */
export function sampleStats() {
  const g = buildSampleGraph()
  const seen = new Set<string>([SAMPLE_START])
  const queue = [SAMPLE_START]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of g.adj[cur]) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
  }
  const span = haversine(g.nodes[SAMPLE_START], g.nodes[SAMPLE_GOAL])
  return { nodes: SAMPLE_NODE_COUNT, edges: SAMPLE_EDGE_COUNT, reachable: seen.size, spanKm: span }
}
