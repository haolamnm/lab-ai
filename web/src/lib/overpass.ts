import { hash, haversine, paddedBounds, pathKm, type LatLng } from './geo'
import type { Detail, Graph, GraphEdge, GraphNode, RoadClass, TurnRule, TurnTable } from './types'

/** Cấp đường lấy về theo từng mức chi tiết. */
const CLASSES: Record<Detail, RoadClass[]> = {
  coarse: ['motorway', 'trunk', 'primary'],
  medium: ['motorway', 'trunk', 'primary', 'secondary'],
  fine:   ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'],
  alleys: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'alley'],
}

/**
 * Cấp đường phụ phải lấy kèm, rồi quy về đúng cấp đường chính của nó.
 *
 * Đường dẫn lên xuống (`*_link`) là các nhánh nối cầu vượt và nút giao khác mức.
 * Thiếu chúng thì không có lối lên cũng không có lối xuống trục lớn, và mạng
 * lưới vỡ thành nhiều mảnh chỉ đi được một chiều. Đo trên vùng Đức Bà – Thảo
 * Điền, cụm liên thông mạnh lớn nhất ở mức "Đường vừa" nhảy từ 74% lên 85% chỉ
 * nhờ thêm 199 nhánh nối này.
 *
 * `unclassified` và `living_street` là đường phố thật, chỉ khác cách gắn thẻ.
 */
const ALIAS: Record<string, RoadClass> = {
  motorway_link: 'motorway', trunk_link: 'trunk', primary_link: 'primary',
  secondary_link: 'secondary', tertiary_link: 'tertiary',
  unclassified: 'residential', living_street: 'residential',
}

/** Cấp đường thật sự hỏi Overpass, gồm cả các cấp phụ quy về cấp đang bật.
 *  Hẻm để riêng vì OpenStreetMap gắn thẻ nó là `highway=service` + `service=alley`,
 *  không cùng dạng biểu thức với các cấp còn lại. */
function osmClasses(detail: Detail): string[] {
  const want = new Set<string>(CLASSES[detail].filter(c => c !== 'alley'))
  for (const [alias, main] of Object.entries(ALIAS)) if (want.has(main)) want.add(alias)
  return [...want]
}

export const DETAIL_LABEL: Record<Detail, string> = {
  coarse: 'Trục chính',
  medium: 'Đường vừa',
  fine:   'Đường nhỏ',
  alleys: 'Cả hẻm',
}

/** Mức đông đúc nền theo cấp đường, trước khi cộng nhiễu. */
const BASE_JAM: Record<RoadClass, number> = {
  motorway: 2, trunk: 3, primary: 4, secondary: 4, tertiary: 3, residential: 2, alley: 1,
}
/** Rủi ro nền: đường càng nhỏ càng nhiều giao cắt khuất, ngập, xe cắt ngang. */
const BASE_RISK: Record<RoadClass, number> = {
  motorway: 0.10, trunk: 0.20, primary: 0.25, secondary: 0.30, tertiary: 0.40, residential: 0.55,
  // Hẻm không kẹt nhưng khuất tầm nhìn, mặt đường xấu, người và xe cắt ngang liên tục.
  alley: 0.70,
}

/** Một phần tử Overpass trả về. Truy vấn hỏi cả tuyến đường lẫn quan hệ cấm rẽ
 *  trong một lượt, nên hai loại về chung một mảng. */
interface OsmElement {
  type: 'way' | 'relation' | 'node'
  id: number
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
  /** Mã nút OpenStreetMap, khớp một-một với từng điểm trong `geometry`. */
  nodes?: number[]
  members?: { type: string; ref: number; role: string }[]
}
type OsmWay = OsmElement
type OsmRelation = OsmElement

const key = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`

/** "06:00-09:00,16:00-19:00" → [[360,540],[960,1140]], tính bằng phút từ nửa đêm. */
function parseHours(spec: string): [number, number][] {
  const out: [number, number][] = []
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
    if (!m) continue
    out.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]])
  }
  return out
}

/**
 * Đọc các quan hệ cấm rẽ thành bảng tra.
 *
 * Chỉ nhận quan hệ có `via` là một nút giao. Loại `via` là cả một tuyến đường —
 * dùng cho nút giao nhiều nhánh phức tạp — chiếm khoảng một phần tư và cần mô
 * hình khác hẳn, nên bỏ qua; thà thiếu một lệnh cấm còn hơn dựng sai một lệnh.
 */
function readTurns(relations: OsmRelation[]): TurnTable {
  const table: TurnTable = { no: {}, only: {} }
  for (const rel of relations) {
    const tags = rel.tags ?? {}
    const cond = tags['restriction:conditional']
    const plain = tags.restriction

    let kind = plain
    let hours: [number, number][] = []
    if (!kind && cond) {
      // "no_left_turn @ (06:00-09:00,16:00-19:00)"
      const m = cond.match(/^\s*([a-z_]+)\s*@\s*\((.+)\)\s*$/)
      if (!m) continue
      kind = m[1]
      hours = parseHours(m[2])
      if (!hours.length) continue
    }
    if (!kind || !/^(no|only)_/.test(kind)) continue

    const from = rel.members?.find(m => m.role === 'from' && m.type === 'way')
    const to = rel.members?.find(m => m.role === 'to' && m.type === 'way')
    const via = rel.members?.find(m => m.role === 'via' && m.type === 'node')
    if (!from || !to || !via) continue

    const except = (tags.except ?? '').split(';').map(s => s.trim()).filter(Boolean)
    const rule: TurnRule = { kind, hours, except }

    if (kind.startsWith('only_')) {
      const k = `n${via.ref}|${from.ref}`
      ;(table.only[k] ??= []).push({ ...rule, onlyTo: to.ref })
    } else {
      const k = `n${via.ref}|${from.ref}|${to.ref}`
      ;(table.no[k] ??= []).push(rule)
    }
  }
  return table
}

/**
 * Định danh một điểm trên tuyến đường.
 *
 * Dùng mã nút do OpenStreetMap cấp, vì đó mới là định danh thật: hai tuyến
 * đường nối nhau khi và chỉ khi chúng dùng chung một mã nút. Toạ độ làm tròn
 * chỉ là phương án dự phòng nếu máy chủ không trả mảng `nodes`.
 *
 * Đo trên 16.224 điểm quanh Đức Bà – Thảo Điền: cách làm tròn toạ độ tới năm
 * chữ số (khoảng 1,1 m) đếm ra đúng 3.929 nút giao, không hơn không kém so với
 * đếm bằng mã nút — nên nó không sai chỗ nhận diện nút giao. Nhưng nó gộp nhầm
 * 17 cặp nút vốn tách rời, tức là dựng ra 17 lối đi không có thật, thường là
 * chỗ cầu vượt và đường bên dưới tình cờ trùng toạ độ. Dùng mã nút thì cả lớp
 * lỗi ấy biến mất mà không tốn thêm gì.
 */
const pointId = (w: OsmWay, i: number): string =>
  w.nodes?.[i] != null ? `n${w.nodes[i]}` : key(w.geometry![i].lat, w.geometry![i].lon)

export class GraphBuildError extends Error {
  constructor(
    message: string,
    /** Đúng khi lỗi có thể tự khắc phục bằng cách đổi mức chi tiết. */
    readonly needsMoreDetail = false,
    /** Đúng khi lỗi do máy chủ chập chờn, thử lại là có thể xong. */
    readonly transient = false,
  ) { super(message) }
}

/** Diện tích hành lang tối đa cho từng mức chi tiết, tính bằng km². */
// Hiệu chỉnh theo số liệu đo thật: hành lang 454 km² ở mức "thêm đường vừa" trả về
// 732 đoạn đường, 0.8 MB, hai mươi giây — nên hạn mức cũ đặt quá chặt. Diện tích chỉ
// là thước đo thô vì mật độ đường nội thành dày hơn ngoại tỉnh nhiều lần; chốt chặn
// thật nằm ở hạn giờ bảy mươi lăm giây.
const AREA_LIMIT: Record<Detail, number> = { coarse: 3000, medium: 700, fine: 60, alleys: 14 }

/**
 * Bề rộng hành lang quanh tuyến, tính bằng km.
 *
 * Hẹp quá thì thuật toán không có đường nào để vòng tránh, và tệ hơn là mạng
 * lưới bị đứt: quốc lộ nối hai tỉnh hiếm khi bám sát đường thẳng nối hai điểm,
 * nó vòng ra ngoài dải hẹp rồi vòng lại, để lại hai mẩu rời nhau. Rộng quá thì
 * tải về cả những vùng chẳng liên quan.
 *
 * Vì vậy trần bề rộng phụ thuộc mức chi tiết. Mức trục chính rất nhẹ — bảy trăm
 * đoạn đường cho bảy mươi ki-lô-mét — nên cho nó dải rộng để bắt trọn quốc lộ.
 * Mức chi tiết cao thì phải bó hẹp, nếu không khối lượng tải sẽ nổ.
 */
const RADIUS_CAP: Record<Detail, number> = { coarse: 12, medium: 4, fine: 2.5, alleys: 1.4 }

export function corridorRadius(points: LatLng[], detail: Detail): number {
  return Math.min(RADIUS_CAP[detail], Math.max(1.2, 0.25 * routeSpan(points)))
}

function routeSpan(points: LatLng[]): number {
  let km = 0
  for (let i = 0; i + 1 < points.length; i++) km += haversine(points[i], points[i + 1])
  return km
}

/** Diện tích hành lang: một hình chữ nhật dài cộng hai nửa hình tròn ở hai đầu. */
function corridorArea(points: LatLng[], detail: Detail): number {
  const r = corridorRadius(points, detail)
  return 2 * r * routeSpan(points) + Math.PI * r * r
}

/**
 * Kiểm tra khối lượng cần tải có vừa sức không, trước khi gọi Overpass.
 *
 * Tải cả một vùng rộng ở mức chi tiết cao nghĩa là hàng trăm nghìn đoạn đường:
 * Overpass hết giờ, trình duyệt hết bộ nhớ, người dùng chỉ nhận một câu báo lỗi
 * vô nghĩa. Chặn sớm và nói rõ cách sửa thì hơn.
 */
export function areaProblem(points: LatLng[], detail: Detail): string | null {
  const km2 = corridorArea(points, detail)
  if (km2 <= AREA_LIMIT[detail]) return null

  // Gợi ý mức chi tiết cao nhất còn vừa sức, không phải mức thô nhất.
  const fits = (['alleys', 'fine', 'medium', 'coarse'] as Detail[])
    .find(d => corridorArea(points, d) <= AREA_LIMIT[d])
  const len = Math.round(routeSpan(points))
  const wide = corridorRadius(points, detail).toFixed(1)
  return fits
    ? `Tuyến dài ${len} km nên phải tải dải đường rộng ${wide} km mỗi bên — quá sức cho mức `
      + `"${DETAIL_LABEL[detail]}". Chuyển sang mức "${DETAIL_LABEL[fits]}" là chạy được.`
    : `Tuyến dài ${len} km, vượt khả năng tải của cả mức "${DETAIL_LABEL.coarse}". `
      + `Hãy chọn hai điểm gần nhau hơn.`
}


/** Máy chủ Overpass công cộng lúc đông hay bỏ dở giữa chừng bằng mã 504 dù truy
 *  vấn hoàn toàn hợp lệ — cùng một câu hỏi, lúc hỏng lúc xong trong bốn giây.
 *  Vì vậy thử lại vài lần trước khi kết luận, để buổi quay video không chết oan
 *  vì máy chủ đang bận. */
const RETRY_WAITS = [0, 4_000, 9_000]

async function fetchElements(query: string, signal?: AbortSignal): Promise<OsmElement[]> {
  // Hạn giờ tính cho cả loạt thử lại, không phải từng lượt.
  const cutoff = AbortSignal.timeout(75_000)
  const merged = signal ? AbortSignal.any([signal, cutoff]) : cutoff
  let last: GraphBuildError | null = null

  for (const wait of RETRY_WAITS) {
    if (wait) await new Promise(r => setTimeout(r, wait))
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(query), signal: merged,
        // Overpass từ chối User-Agent mặc định của Node bằng mã 406. Trình duyệt
        // luôn tự gửi User-Agent thật nên không cần, nhưng khai báo ở đây để chạy
        // kiểm thử ngoài trình duyệt cũng được — trình duyệt sẽ bỏ qua dòng này.
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'vn-route-lab/0.1 (bai tap mon Nhap mon Tri tue nhan tao)',
        },
      })
      if (res.status === 504 || res.status === 429 || res.status === 503) {
        last = new GraphBuildError(
          'OpenStreetMap đang quá tải. Đã thử lại vài lần nhưng chưa được — chờ một phút rồi bấm dựng lại, '
          + 'hoặc giảm mức chi tiết.', false, true)
        continue
      }
      if (!res.ok) throw new GraphBuildError(`OpenStreetMap trả về mã ${res.status}. Chờ ít phút rồi thử lại.`)
      return (await res.json()).elements || []
    } catch (e) {
      if (e instanceof GraphBuildError) throw e
      const name = (e as Error).name
      if (name === 'TimeoutError')
        throw new GraphBuildError('Tải mạng lưới quá 75 giây nên đã dừng. Giảm mức chi tiết hoặc chọn hai điểm gần nhau hơn.')
      if (name === 'AbortError') throw e
      // Mạng chập chờn cũng đáng thử lại.
      last = new GraphBuildError(`Không gọi được OpenStreetMap: ${(e as Error).message}`, false, true)
    }
  }
  throw last ?? new GraphBuildError('Không tải được mạng lưới đường.')
}

/**
 * Dựng mạng lưới đường thật từ OpenStreetMap cho vùng bao quanh các điểm
 * người dùng chọn. Trả về đồ thị đã rút gọn: chỉ giữ nút giao, các đoạn
 * đường thẳng ở giữa được gộp lại thành một cạnh mang hình dạng thật.
 */
export async function buildGraph(points: LatLng[], detail: Detail, signal?: AbortSignal): Promise<Graph> {
  const tooBig = areaProblem(points, detail)
  if (tooBig) throw new GraphBuildError(tooBig)

  // Hai cách khoanh vùng, chọn theo độ dài chuyến.
  //
  // Chuyến trong thành phố dùng hình chữ nhật: Overpass có sẵn chỉ mục không
  // gian cho hình chữ nhật nên trả lời gần như tức thì, còn bộ lọc around phải
  // đo khoảng cách tới từng đoạn đường và với máy chủ công cộng đang đông thì
  // đủ chậm để bị cắt giữa chừng bằng mã 504 — kể cả khi vùng chỉ vài km².
  //
  // Chuyến liên tỉnh thì ngược lại, bắt buộc dùng hành lang: hình chữ nhật bao
  // quanh hai tỉnh rộng hàng nghìn km² trong khi dải đường thật sự cần chỉ vài
  // trăm. Bộ lọc around nhận cả một đường gấp khúc, nên hành trình nhiều điểm
  // giao cũng chỉ tải đúng dải bám theo thứ tự ghé.
  const filter = osmClasses(detail).join('|')
  const span = routeSpan(points)
  let area: string
  if (span < 8) {
    const b = paddedBounds(points)
    area = `(${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)})`
  } else {
    const line = points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(',')
    area = `(around:${Math.round(corridorRadius(points, detail) * 1000)},${line})`
  }
  // Lấy kèm quan hệ cấm rẽ chạm vào các tuyến đường vừa lấy. `rel(bw.roads)`
  // lọc ngay trên máy chủ nên không tốn thêm lượt gọi nào.
  // Hẻm phải hỏi bằng một mệnh đề riêng. Trong OpenStreetMap chúng là
  // `highway=service` kèm `service=alley`, và phải lọc đúng `alley` chứ không
  // lấy cả `service` — bằng không sẽ vơ luôn lối vào bãi đỗ và đường dẫn vào
  // nhà, những thứ không nối đi đâu cả.
  const wantAlleys = CLASSES[detail].includes('alley')
  const alleyClause = wantAlleys
    ? `way["highway"="service"]["service"="alley"]["access"!~"^(private|no)$"] ${area}->.alleys;`
    : ''

  const query = `[out:json][timeout:60];
way["highway"~"^(${filter})$"]["access"!~"^(private|no)$"]
  ${area}->.main;
${alleyClause}
(.main;${wantAlleys ? ' .alleys;' : ''})->.roads;
(
  .roads;
  rel(bw.roads)["type"="restriction"];
);
out geom;`

  const elements = await fetchElements(query, signal)
  const ways = elements.filter(e => e.type === 'way' && (e.geometry?.length ?? 0) > 1)
  const turns = readTurns(elements.filter(e => e.type === 'relation'))
  if (!ways.length)
    throw new GraphBuildError('Vùng này không có đường nào ở mức chi tiết đã chọn. Thử tăng mức chi tiết.')

  // Điểm nào được nhiều tuyến đường dùng chung thì đó là nút giao.
  const waysAtPoint = new Map<string, Set<number>>()
  for (const w of ways)
    for (let i = 0; i < w.geometry!.length; i++) {
      const k = pointId(w, i)
      if (!waysAtPoint.has(k)) waysAtPoint.set(k, new Set())
      waysAtPoint.get(k)!.add(w.id)
    }

  const nodes: Record<string, GraphNode> = {}
  const edges: GraphEdge[] = []

  for (const w of ways) {
    const tags = w.tags ?? {}
    const raw = tags.highway || 'residential'
    // Hẻm nào ghi rõ ô tô vào được thì coi như đường khu dân cư bình thường —
    // đo trong vùng trung tâm thì chỉ đúng một tuyến, nhưng tôn trọng dữ liệu.
    const cls: RoadClass = raw === 'service'
      ? (tags.motorcar === 'yes' ? 'residential' : 'alley')
      : ((ALIAS[raw] ?? raw) as RoadClass)
    const g = w.geometry!

    // Một chiều. Ba nguồn: thẻ oneway, vòng xuyến, và quy ước ngầm của
    // OpenStreetMap là đường cao tốc mặc định một chiều dù không gắn thẻ.
    // `oneway=-1` nghĩa là chiều đi ngược với thứ tự điểm của tuyến, phải đảo
    // lại chứ không phải bỏ qua. Đo quanh Đức Bà – Thảo Điền thì cả hai trường
    // hợp sau đều bằng không, nhưng chúng vẫn có thật ở nơi khác và xử lý đúng
    // chỉ tốn một dòng.
    const reversed = tags.oneway === '-1' || tags.oneway === 'reverse'
    const oneway = reversed
      || ['yes', 'true', '1'].includes(tags.oneway)
      || tags.junction === 'roundabout' || tags.junction === 'circular'
      || (cls === 'motorway' && tags.oneway !== 'no')

    const isJunction = (i: number) =>
      i === 0 || i === g.length - 1 || (waysAtPoint.get(pointId(w, i))?.size ?? 0) > 1

    let anchorIdx = 0
    for (let i = 1; i < g.length; i++) {
      if (!isJunction(i)) continue
      const head = g[anchorIdx], tail = g[i]
      const a = pointId(w, anchorIdx)
      const bk = pointId(w, i)
      const shape = g.slice(anchorIdx, i + 1).map(p => [p.lat, p.lon] as [number, number])
      anchorIdx = i
      if (a === bk) continue

      const km = pathKm(shape)
      if (km < 0.001) continue

      nodes[a]  ??= { id: a,  lat: head.lat, lng: head.lon }
      nodes[bk] ??= { id: bk, lat: tail.lat, lng: tail.lon }

      // Điều kiện giao thông mô phỏng, nhưng cố định theo tuyến đường:
      // chạy lại bao nhiêu lần cũng ra cùng kết quả, nên so sánh mới có nghĩa.
      const r = hash(`${w.id}:${a}`)
      const congestion = Math.min(5, Math.max(1, Math.round(BASE_JAM[cls] + (r - 0.5) * 2.2)))
      const risk = Math.min(1, Math.max(0, +(BASE_RISK[cls] + (hash(`r${w.id}:${a}`) - 0.5) * 0.3).toFixed(2)))

      const name = tags.name
      const rest = { km: +km.toFixed(4), roadClass: cls, congestion, risk, name, wayId: w.id }
      const back = [...shape].reverse()

      if (reversed) edges.push({ from: bk, to: a, ...rest, shape: back })
      else edges.push({ from: a, to: bk, ...rest, shape })
      if (!oneway) edges.push({ from: bk, to: a, ...rest, shape: back })
    }
  }

  const adj: Record<string, GraphEdge[]> = {}
  for (const id of Object.keys(nodes)) adj[id] = []
  for (const e of edges) adj[e.from].push(e)

  const kept = bestComponent(nodes, adj, points)
  if (kept.size < 8)
    throw new GraphBuildError('Mạng lưới lấy về quá rời rạc để tìm đường. Thử tăng mức chi tiết hoặc chọn hai điểm gần nhau hơn.')

  const worst = Math.max(...points.map(p => {
    let best = Infinity
    kept.forEach(id => { const d = haversine(p, nodes[id]); if (d < best) best = d })
    return best
  }))
  if (worst > 3)
    throw new GraphBuildError(
      `Ở mức "${DETAIL_LABEL[detail]}" mạng lưới bị đứt đoạn: cụm đường liền mạch lớn nhất còn cách `
      + `một trong các điểm tới ${worst.toFixed(0)} km.`, true)

  const fNodes: Record<string, GraphNode> = {}
  kept.forEach(id => (fNodes[id] = nodes[id]))
  const fEdges = edges.filter(e => kept.has(e.from) && kept.has(e.to))
  const fAdj: Record<string, GraphEdge[]> = {}
  kept.forEach(id => (fAdj[id] = []))
  for (const e of fEdges) fAdj[e.from].push(e)

  const lats = Object.values(fNodes).map(n => n.lat)
  const lngs = Object.values(fNodes).map(n => n.lng)
  return {
    nodes: fNodes, edges: fEdges, adj: fAdj, detail, turns,
    bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
  }
}

/**
 * Chia mạng lưới thành các cụm **liên thông mạnh**: trong một cụm, đi xuôi
 * chiều từ nút nào cũng tới được mọi nút còn lại.
 *
 * Phải là liên thông mạnh chứ không phải liên thông thường, vì đường một chiều
 * làm hai thứ đó khác hẳn nhau. Đo trên chính trung tâm Sài Gòn: 73% tuyến
 * đường lấy về mang thẻ `oneway=yes`, do đại lộ có dải phân cách được vẽ thành
 * hai tuyến một chiều song song. Bỏ chiều đi mà xét thì cả 506 nút trông như
 * một khối liền, nhưng đi xuôi chiều thật thì từ điểm xuất phát chỉ tới được
 * 374 nút — 132 nút còn lại nằm trong đồ thị mà không đường nào dẫn tới.
 *
 * Giữ nguyên chúng thì việc dựng mạng lưới báo thành công rồi thuật toán mới
 * báo không tới được, và lời giải thích đổ oan cho mạng lưới đứt đoạn trong khi
 * đường thì vẫn nối, chỉ là ngược chiều.
 *
 * Dùng Kosaraju, duyệt bằng ngăn xếp tường minh vì mạng lưới có hàng nghìn nút.
 */
function stronglyConnected(
  nodes: Record<string, GraphNode>,
  adj: Record<string, GraphEdge[]>,
): Set<string>[] {
  const ids = Object.keys(nodes)
  const rev: Record<string, string[]> = {}
  for (const id of ids) rev[id] = []
  for (const list of Object.values(adj)) for (const e of list) rev[e.to]?.push(e.from)

  // Lượt một: ghi lại thứ tự kết thúc duyệt.
  const done = new Set<string>()
  const order: string[] = []
  for (const root of ids) {
    if (done.has(root)) continue
    const stack: { id: string; at: number }[] = [{ id: root, at: 0 }]
    done.add(root)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const out = adj[top.id] ?? []
      if (top.at < out.length) {
        const next = out[top.at++].to
        if (!done.has(next)) { done.add(next); stack.push({ id: next, at: 0 }) }
      } else {
        order.push(top.id)
        stack.pop()
      }
    }
  }

  // Lượt hai: duyệt đồ thị đảo chiều theo thứ tự kết thúc ngược lại.
  const seen = new Set<string>()
  const out: Set<string>[] = []
  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i]
    if (seen.has(root)) continue
    const comp = new Set([root])
    const queue = [root]
    seen.add(root)
    for (let head = 0; head < queue.length; head++)
      for (const back of rev[queue[head]] ?? [])
        if (!seen.has(back)) { seen.add(back); comp.add(back); queue.push(back) }
    out.push(comp)
  }
  return out
}

/**
 * Giữ lại cụm đường phục vụ được cả hành trình, bỏ các mẩu rời.
 *
 * Không lấy cụm lớn nhất. Trên chuyến liên tỉnh, cụm lớn nhất thường nằm gọn
 * trong thành phố xuất phát vì mạng lưới bị đứt ở giữa; giữ nó thì điểm đến bị
 * ghim cách hàng chục ki-lô-mét và tuyến trả về hoàn toàn vô nghĩa. Chọn cụm
 * nào chạm gần được tới **mọi** điểm trong hành trình, rồi mới xét tới độ lớn.
 */
function bestComponent(
  nodes: Record<string, GraphNode>,
  adj: Record<string, GraphEdge[]>,
  points: LatLng[],
): Set<string> {
  const components = stronglyConnected(nodes, adj)
  if (!components.length) return new Set()

  // Điểm nào của hành trình cũng phải với tới được; lấy khoảng cách tệ nhất làm thước đo.
  const reach = (comp: Set<string>) => Math.max(...points.map(p => {
    let best = Infinity
    comp.forEach(id => { const d = haversine(p, nodes[id]); if (d < best) best = d })
    return best
  }))

  let winner = components[0], score = reach(winner)
  for (const comp of components.slice(1)) {
    const s = reach(comp)
    // Chênh dưới 200m thì coi như ngang nhau, khi đó ưu tiên cụm dày hơn.
    if (s < score - 0.2 || (Math.abs(s - score) <= 0.2 && comp.size > winner.size)) {
      winner = comp; score = s
    }
  }
  return winner
}

/** Nút giao gần một toạ độ nhất, kèm khoảng cách tính bằng mét. */
/**
 * Nút giao gần một toạ độ nhất, kèm khoảng cách tính bằng mét.
 *
 * Có thể lọc theo loại xe: xe tải không đỗ được trong hẻm, nên phải ghim ra
 * nút giao gần nhất mà nó thật sự rời đi được. Thiếu bước lọc này thì chọn xe
 * tải là mọi tuyến đều báo không tới được, dù đường lớn ngay bên cạnh.
 */
export function snap(
  graph: Graph,
  p: LatLng,
  usable?: (nodeId: string) => boolean,
): { nodeId: string; metres: number } {
  let nodeId = '', best = Infinity
  for (const n of Object.values(graph.nodes)) {
    if (usable && !usable(n.id)) continue
    const d = haversine(p, n)
    if (d < best) { best = d; nodeId = n.id }
  }
  // Không có nút nào hợp lệ thì thà ghim bừa còn hơn trả về rỗng.
  if (!nodeId) return snap(graph, p)
  return { nodeId, metres: Math.round(best * 1000) }
}
