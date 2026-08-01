/** Một địa điểm người dùng chọn — chưa gắn với mạng lưới đường. */
export interface Place {
  name: string
  detail?: string
  lat: number
  lng: number
}

/** Nút giao trong mạng lưới đường dựng từ dữ liệu OpenStreetMap. */
export interface GraphNode {
  id: string
  lat: number
  lng: number
  /** Chữ cái ngắn để gọi tên nút khi giảng giải. Chỉ đồ thị mẫu mới có. */
  label?: string
  /** Tên địa điểm. Chỉ đồ thị mẫu mới có; nút lấy từ OpenStreetMap không có tên. */
  name?: string
}

/** Một đoạn đường nối hai nút giao, kèm hình dạng thật của con đường. */
export interface GraphEdge {
  from: string
  to: string
  km: number
  /** Cấp đường theo OpenStreetMap: motorway, primary, residential… */
  roadClass: RoadClass
  /** Mức đông đúc 1–5, mô phỏng từ cấp đường (xem lib/traffic.ts). */
  congestion: number
  /** Hệ số rủi ro 0–1: đường hẹp, giao cắt khó, ngập nước. */
  risk: number
  /** Tên đường theo OpenStreetMap, dùng để gọi tên đoạn kẹt khi giải thích. */
  name?: string
  /** Toạ độ dọc theo đường thật, để vẽ đúng hình con đường. */
  shape: [number, number][]
  /** Mã tuyến đường OpenStreetMap. Cấm rẽ được ghi theo cặp tuyến đường, nên
   *  không có mã này thì không đối chiếu được. Đồ thị mẫu không có. */
  wayId?: number
}

/**
 * Một lệnh cấm rẽ tại một nút giao.
 *
 * Biển "cấm rẽ trái" ở Việt Nam hiếm khi cấm suốt ngày và hiếm khi cấm mọi xe.
 * Đo trên dữ liệu OpenStreetMap vùng trung tâm TP.HCM: trong 757 quan hệ cấm rẽ
 * thì 491 dùng `restriction:conditional` — cấm theo khung giờ — và 459 mang
 * `except=motorcycle;bicycle;mofa;moped`, tức xe máy được miễn.
 *
 * Đó chính là hai trục ứng dụng đã có sẵn: khung giờ và loại xe.
 */
export interface TurnRule {
  /** no_left_turn, no_u_turn, only_straight_on… */
  kind: string
  /** Khung giờ áp dụng, tính bằng phút từ nửa đêm. Rỗng nghĩa là cấm cả ngày. */
  hours: [number, number][]
  /** Loại xe được miễn, theo từ khoá OpenStreetMap. */
  except: string[]
  /** Với lệnh `only_*`: mã tuyến đường duy nhất được phép đi tiếp. */
  onlyTo?: number
}

/**
 * Tra cứu cấm rẽ.
 * `no`   khoá `${nút}|${tuyến đến}|${tuyến đi}` — cặp bị cấm.
 * `only` khoá `${nút}|${tuyến đến}`            — chỉ được đi đúng một hướng.
 */
export interface TurnTable {
  no: Record<string, TurnRule[]>
  only: Record<string, TurnRule[]>
}

export type RoadClass =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'alley'

export interface Graph {
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
  adj: Record<string, GraphEdge[]>
  bounds: [[number, number], [number, number]]
  /** Cấp đường đã dùng khi dựng, để hiện lại cho người dùng. */
  detail: Detail
  /** Cấm rẽ lấy từ OpenStreetMap. Đồ thị mẫu không có. */
  turns?: TurnTable
}

export type Detail = 'coarse' | 'medium' | 'fine' | 'alleys'
export type AlgoKey = 'bfs' | 'dfs' | 'ucs' | 'astar' | 'greedy'
export type VehicleKey = 'bike' | 'van' | 'car' | 'truck'
export type PeriodKey = 'peak' | 'offpeak' | 'night'
export type CriterionKey = 'balanced' | 'distance' | 'time' | 'avoid' | 'custom'

export interface Weights {
  distance: number
  time: number
  congestion: number
  risk: number
}

/**
 * Một bước mở nút của thuật toán.
 * Nút được lưu bằng chỉ số thay vì mã chuỗi: một lần chạy trên mạng lưới vài
 * trăm nút sinh ra hàng chục nghìn phần tử hàng đợi, nhân với năm màn hình thì
 * lưu chuỗi sẽ ngốn bộ nhớ vô ích. Đổi ngược lại bằng RouteResult.nodeIds.
 */
export interface TraceStep {
  expanded: number
  frontier: number[]
  g: number
  h: number | null
  /** Nút đã dẫn tới nút này. Tập các cặp cha–con tạo thành cây tìm kiếm, và
   *  hình dạng của cây đó chính là chân dung của thuật toán. */
  parent: number | null
}

export interface Metrics {
  km: number
  minutes: number
  cost: number
  expanded: number
  ms: number
  optimal: boolean
  /** Số lần thuật toán phải bỏ một hướng đi vì gặp biển cấm rẽ. */
  turnsBlocked: number
}

export interface RouteResult {
  algo: AlgoKey
  /** Lý do không chạy được, khi truy vấn tự nó đã vô nghĩa. */
  problem?: string
  /** Thứ tự các điểm phải ghé, sau khi đã tối ưu nếu người dùng bật. */
  order: string[]
  path: string[]
  trace: TraceStep[]
  /** Bảng tra chỉ số nút trong trace về mã nút. */
  nodeIds: string[]
  /** Chặng nào xong ở bước nào — để hiện dần từng đoạn đường. */
  reveal: { upto: number; path: string[] }[]
  found: boolean
  metrics: Metrics
}
