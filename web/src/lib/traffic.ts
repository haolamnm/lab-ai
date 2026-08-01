import type {
  CriterionKey, GraphEdge, PeriodKey, RoadClass, TurnRule, TurnTable, VehicleKey, Weights,
} from './types'

/* ------------------------------------------------------------------
   Phương tiện giao hàng.
   Mỗi loại xe mạnh yếu ở chỗ khác nhau, nên cùng một điểm đi và điểm
   đến vẫn ra tuyến khác nhau — đây là chỗ bài toán mang tính Việt Nam
   rõ nhất, vì shipper xe máy và xe tải thực tế không đi cùng đường.
   ------------------------------------------------------------------ */
export interface Vehicle {
  key: VehicleKey
  name: string
  /** Hệ số nhân tốc độ trên đường thoáng. Xe máy KHÔNG cao hơn ô tô ở đây —
   *  đường trống thì ô tô nhanh hơn; lợi thế xe máy nằm ở `jamSensitivity`. */
  speed: number
  /** Mức chịu ảnh hưởng của kẹt xe. Xe máy luồn được nên thấp hơn 1. */
  jamSensitivity: number
  /** Nhân với hệ số rủi ro của đoạn đường. */
  riskFactor: number
  /** Cấp đường xe này không bao giờ đi được, bất kể khung giờ. */
  banned: RoadClass[]
  /** Cấp đường chỉ bị cấm trong một số khung giờ — giờ cấm tải nội thành. */
  curfew?: { periods: PeriodKey[]; classes: RoadClass[]; note: string }
  /** Từ khoá OpenStreetMap ứng với loại xe này, để đối chiếu miễn trừ cấm rẽ. */
  osmExcept: string[]
  strength: string
  weakness: string
}

export const VEHICLES: Vehicle[] = [
  {
    key: 'bike', name: 'Xe máy',
    // Loại xe duy nhất đi được hẻm. Đo trong vùng trung tâm TP.HCM: 4345 con
    // hẻm, và 37% trong số đó ghi rõ `motorcar=no` hoặc `motorcar=destination`.
    speed: 0.95, jamSensitivity: 0.55, riskFactor: 1.3, banned: ['motorway'],
    osmExcept: ['motorcycle', 'moped', 'mofa'],
    strength: 'Loại duy nhất đi được hẻm, luồn được khi kẹt, đa số biển cấm rẽ miễn xe máy',
    weakness: 'Cấm cao tốc, chở ít, rủi ro cao hơn, đường trống thì thua ô tô',
  },
  {
    key: 'van', name: 'Xe van',
    speed: 1.0, jamSensitivity: 1.0, riskFactor: 1.0, banned: ['alley'],
    osmExcept: [],
    strength: 'Đi được mọi đường phố, không dính giờ cấm tải',
    weakness: 'Không nhanh hơn ai ở điều kiện nào, không vào hẻm được',
  },
  {
    key: 'car', name: 'Ô tô con',
    speed: 1.10, jamSensitivity: 1.15, riskFactor: 0.8, banned: ['alley'],
    osmExcept: [],
    strength: 'Nhanh nhất khi đường thoáng, an toàn, đi được cao tốc',
    weakness: 'Kẹt là chịu chết, không vào hẻm, dính đủ mọi biển cấm rẽ',
  },
  {
    // Xe tải nhẹ giao hàng vẫn đi được đường nhánh, chỉ không vào nổi hẻm — nên
    // lệnh cấm suốt ngày chỉ còn `residential`. Cái chặn thật ở nội thành là
    // giờ cấm tải, và đó là một ràng buộc theo giờ chứ không theo cấp đường.
    key: 'truck', name: 'Xe tải',
    speed: 0.75, jamSensitivity: 1.25, riskFactor: 1.6, banned: ['residential', 'alley'],
    curfew: {
      periods: ['peak'], classes: ['tertiary', 'secondary'],
      note: 'Giờ cấm tải: cao điểm không được vào đường nhánh và đường lớn nội thành',
    },
    osmExcept: ['hgv', 'goods'],
    strength: 'Chở được khối lượng lớn nhất',
    weakness: 'Cấm hẻm và đường khu dân cư, dính giờ cấm tải, chậm, phạt nặng đoạn rủi ro',
  },
]
export const vehicleOf = (k: VehicleKey) => VEHICLES.find(v => v.key === k)!

/**
 * Bốn thang đo để so sánh phương tiện, tất cả đều suy ra từ chính các hệ số
 * dùng trong hàm chi phí. Không đặt tay con số nào: nếu ai đó chỉnh hệ số của
 * một loại xe, thang đo tự đổi theo, giao diện không thể nói sai về mô hình.
 */
export interface Trait { name: string; value: number; hue: string; hint: string }

const scale = (v: number, lo: number, hi: number) =>
  Math.round(1 + 4 * Math.min(1, Math.max(0, (v - lo) / (hi - lo))))

/** Biên của một hệ số, lấy từ chính bảng phương tiện — viết cứng là có ngày
 *  chỉnh hệ số mà quên chỉnh thang, rồi giao diện nói sai về mô hình. */
const span = (pick: (v: Vehicle) => number): [number, number] =>
  [Math.min(...VEHICLES.map(pick)), Math.max(...VEHICLES.map(pick))]

export function traitsOf(key: VehicleKey): Trait[] {
  const v = vehicleOf(key)
  return [
    {
      name: 'Tốc độ', value: scale(v.speed, ...span(x => x.speed)), hue: '#0a736f',
      hint: 'Tốc độ chạy trên đường thoáng, chưa tính kẹt xe',
    },
    {
      name: 'Luồn khi kẹt', value: scale(-v.jamSensitivity, ...span(x => -x.jamSensitivity)), hue: '#b0651c',
      hint: 'Mức ít bị kẹt xe làm chậm',
    },
    {
      name: 'An toàn', value: scale(-v.riskFactor, ...span(x => -x.riskFactor)), hue: '#2a6b8f',
      hint: 'Mức ít bị phạt trên đoạn đường rủi ro',
    },
    {
      // Cấm suốt ngày phạt nặng hơn cấm theo giờ, vì cấm theo giờ còn né được
      // bằng cách đổi khung giờ.
      name: 'Đường vào được',
      value: Math.max(1, 5 - v.banned.length * 2 - (v.curfew?.classes.length ?? 0)),
      hue: '#6d4aa8',
      hint: v.curfew
        ? `Cấm ${v.banned.length} cấp đường, thêm ${v.curfew.classes.length} cấp trong giờ cấm tải`
        : v.banned.length ? `Bị cấm ${v.banned.length} cấp đường` : 'Đi được mọi cấp đường',
    },
  ]
}

/* ------------------------------------------------------------------ */

/**
 * Khung giờ tác động qua **mức kẹt xe**, không phải qua tốc độ nền.
 *
 * Bản trước nhân thẳng tốc độ nền theo khung giờ, và điều đó sai một cách kín
 * đáo: nhân tốc độ thì nhân cho mọi loại xe như nhau, nên lợi thế luồn lách của
 * xe máy trở thành một tỉ lệ cố định, giờ nào cũng đúng bằng ngần ấy. Đo được
 * hệ số kẹt làm chậm của xe máy là ×1,92 và của ô tô là ×2,93 — **y hệt nhau ở
 * cả cao điểm lẫn thấp điểm**. Tức là mô hình nói hai giờ sáng xe máy vẫn hơn ô
 * tô đúng ngần ấy phần trăm, chuyện không có thật.
 *
 * Cái thay đổi theo giờ là đường có kẹt hay không. Nên khung giờ nhân vào phần
 * kẹt: ban đêm mức kẹt gần như biến mất, mọi xe chạy ở tốc độ thoáng, và khi ấy
 * ô tô nhanh hơn xe máy — đúng như ngoài đời.
 */
export const PERIODS: { key: PeriodKey; name: string; jam: number; hue: string }[] = [
  { key: 'peak',    name: 'Cao điểm',  jam: 1.00, hue: '#e85d5d' },
  { key: 'offpeak', name: 'Thấp điểm', jam: 0.55, hue: '#c98a2e' },
  { key: 'night',   name: 'Ban đêm',   jam: 0.18, hue: '#4f5d9e' },
]
export const periodOf = (k: PeriodKey) => PERIODS.find(p => p.key === k)!

/** Tốc độ đường thoáng theo cấp đường, km/h — chưa trừ kẹt xe. */
const CLASS_SPEED: Record<RoadClass, number> = {
  motorway: 60, trunk: 45, primary: 32, secondary: 26, tertiary: 22, residential: 16,
  // Hẻm không kẹt nhưng hẹp, quanh co, người đi bộ và xe dựng chắn lối.
  alley: 11,
}

export const CRITERIA: Record<Exclude<CriterionKey, 'custom'>, { name: string; weights: Weights }> = {
  balanced: { name: 'Cân bằng',   weights: { distance: 1.0, time: 0.5, congestion: 0.8, risk: 1.5 } },
  distance: { name: 'Ngắn nhất',  weights: { distance: 1.0, time: 0.0, congestion: 0.0, risk: 0.0 } },
  time:     { name: 'Nhanh nhất', weights: { distance: 0.0, time: 1.0, congestion: 0.0, risk: 0.0 } },
  avoid:    { name: 'Né kẹt xe',  weights: { distance: 0.3, time: 0.6, congestion: 2.5, risk: 1.0 } },
}

export interface Conditions {
  vehicle: VehicleKey
  period: PeriodKey
  weights: Weights
}

/**
 * Cả bốn trọng số đều bằng 0 thì hàm chi phí trả về 0 cho mọi đoạn đường, và
 * mọi tuyến đều có chi phí bằng nhau — tức bằng 0.
 *
 * Khi đó UCS vẫn "đúng": nó tìm ra tuyến chi phí nhỏ nhất, chỉ là mọi tuyến đều
 * nhỏ nhất. Nó trả về tuyến 20,7 km trong khi tuyến 11,4 km nằm ngay đó, và vẫn
 * đóng dấu TỐI ƯU. Về mặt toán học không sai câu nào, nhưng người dùng đọc chữ
 * "tối ưu" bên cạnh một tuyến vòng vèo thì chỉ kết luận là ứng dụng hỏng.
 *
 * A* cũng chết theo: ước lượng nhân với chi phí thấp nhất trên mỗi ki-lô-mét,
 * mà số đó giờ bằng 0, nên h = 0 và A* thoái hoá thành UCS. Greedy cũng vậy.
 */
export const costIsFlat = (w: Weights) =>
  w.distance === 0 && w.time === 0 && w.congestion === 0 && w.risk === 0

/** Tên gọi từng cấp đường, để nói được vì sao một loại xe bị chặn. */
export const ROAD_LABEL: Record<RoadClass, string> = {
  motorway: 'đường cao tốc',
  trunk: 'quốc lộ',
  primary: 'đường trục chính',
  secondary: 'đường lớn',
  tertiary: 'đường nhánh',
  residential: 'đường khu dân cư',
  alley: 'hẻm',
}

/**
 * Giờ đại diện cho mỗi khung, tính bằng phút từ nửa đêm.
 *
 * Biển cấm rẽ trong OpenStreetMap ghi giờ thật — "06:00-09:00,16:00-19:00" —
 * còn ứng dụng chỉ có ba khung. Lấy một mốc giờ đại diện cho mỗi khung rồi hỏi
 * mốc ấy có nằm trong biển cấm không. Cách này cho kết quả dứt khoát và giải
 * thích được bằng một câu, hơn hẳn việc so chồng lấn hai khoảng giờ — chồng lấn
 * chỉ mười lăm phút cũng làm cả khung giờ bị coi là cấm.
 */
const PERIOD_CLOCK: Record<PeriodKey, number> = {
  peak: 17 * 60 + 30,   // 17:30, cao điểm chiều
  offpeak: 13 * 60,     // 13:00
  night: 22 * 60,       // 22:00
}
export const CLOCK_LABEL: Record<PeriodKey, string> = {
  peak: '17:30', offpeak: '13:00', night: '22:00',
}

const within = (minute: number, [from, to]: [number, number]) =>
  from <= to ? minute >= from && minute < to : minute >= from || minute < to

/** Xe này có bị cấm vào cấp đường ấy trong khung giờ ấy không, kèm lý do. */
export function banReason(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey): string | null {
  const v = vehicleOf(vehicle)
  if (v.banned.includes(edge.roadClass)) return `${v.name} bị cấm ${ROAD_LABEL[edge.roadClass]}`
  if (v.curfew?.periods.includes(period) && v.curfew.classes.includes(edge.roadClass))
    return v.curfew.note
  return null
}

/** Đoạn đường này xe có đi được vào khung giờ này không. */
export function passable(edge: GraphEdge, vehicle: VehicleKey, period: PeriodKey): boolean {
  return banReason(edge, vehicle, period) === null
}

/**
 * Có được rẽ từ đoạn đường này sang đoạn đường kia tại nút giao ấy không.
 *
 * Cấm rẽ là ràng buộc trên **cặp** đoạn đường, không phải trên nút — đó là lý
 * do nó không gói được vào `passable`.
 */
export function turnAllowed(
  turns: TurnTable | undefined,
  via: string,
  from: GraphEdge,
  to: GraphEdge,
  c: Conditions,
): boolean {
  if (!turns || from.wayId == null || to.wayId == null) return true
  const clock = PERIOD_CLOCK[c.period]
  const mine = vehicleOf(c.vehicle).osmExcept

  const active = (r: TurnRule) =>
    (!r.hours.length || r.hours.some(h => within(clock, h)))
    && !r.except.some(x => mine.includes(x))

  if (turns.no[`${via}|${from.wayId}|${to.wayId}`]?.some(active)) return false

  // Lệnh "chỉ được đi hướng X" cấm mọi hướng còn lại.
  const only = turns.only[`${via}|${from.wayId}`]
  if (only?.some(r => active(r) && r.onlyTo !== to.wayId)) return false

  return true
}

/** Thời gian đi hết đoạn đường, tính bằng phút. */
export function edgeMinutes(edge: GraphEdge, c: Conditions): number {
  const v = vehicleOf(c.vehicle)
  // Kẹt xe kéo tốc độ xuống; xe máy chịu ảnh hưởng ít hơn vì luồn được, và
  // khung giờ quyết định đoạn đường ấy có thật sự đang kẹt hay không.
  const jam = 1 + (edge.congestion - 1) * 0.42 * v.jamSensitivity * periodOf(c.period).jam
  const speed = (CLASS_SPEED[edge.roadClass] * v.speed) / jam
  return (edge.km / speed) * 60
}

/**
 * Chi phí của một đoạn đường.
 *
 * Phần kẹt xe và rủi ro đều nhân với chiều dài, không cộng thẳng một cục.
 * Chịu đựng ba trăm mét kẹt cứng không thể tính bằng ba ki-lô-mét kẹt cứng,
 * mà mạng lưới lấy từ OpenStreetMap có rất nhiều đoạn ngắn vài chục mét —
 * cộng cục sẽ phạt oan tuyến nào nhiều nút giao. Nhân theo chiều dài còn cho
 * một lợi ích nữa: mọi thành phần chi phí đều tỉ lệ với quãng đường, nên cận
 * dưới mà A* dùng để ước lượng trở nên sát, và A* mới thật sự mở ít nút hơn.
 */
export function edgeCost(edge: GraphEdge, c: Conditions): number {
  const w = c.weights, v = vehicleOf(c.vehicle)
  return w.distance * edge.km
       + w.time * edgeMinutes(edge, c)
       + w.congestion * edge.congestion * edge.km
       + w.risk * edge.risk * v.riskFactor * edge.km
}
