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

/** Vị trí khung nhìn: dịch bao nhiêu, phóng bao nhiêu lần. */
interface Camera { x: number; y: number; k: number }
const HOME: Camera = { x: 0, y: 0, k: 1 }

/**
 * Cây tìm kiếm của một thuật toán, trải theo kiểu toả tròn.
 *
 * Cùng dòng thời gian với bản đồ: kéo tới bước nào thì cây mọc tới đó. Nhánh
 * nằm trên tuyến cuối được tô mực đen để thấy đường đi thật sự đã đi qua những
 * nhánh nào của cây.
 *
 * Cây vài trăm nút thì nhìn tổng thể chỉ thấy hình dạng chung, muốn đọc từng
 * nhánh phải phóng to được — nên có lăn chuột để phóng, kéo để dời, bấm đúp để
 * về vừa ô.
 */
export function TreeView({ result, step }: Props) {
  const tree = useMemo(() => (result ? buildTree(result) : null), [result])
  const svg = useRef<SVGSVGElement>(null)
  const [cam, setCam] = useState<Camera>(HOME)
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null)

  // Chạy lượt mới thì cây khác hẳn, giữ lại khung nhìn cũ chỉ tổ lạc chỗ.
  useEffect(() => setCam(HOME), [result])

  const onPath = useMemo(() => {
    if (!result) return new Set<number>()
    const index = new Map(result.nodeIds.map((id, i) => [id, i]))
    return new Set(result.path.map(id => index.get(id)!).filter(i => i !== undefined))
  }, [result])

  /** Đổi toạ độ con trỏ trên màn hình sang toạ độ trong khung vẽ. */
  const atCursor = (e: { clientX: number; clientY: number }) => {
    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (!el || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  // Bánh xe chuột đăng ký thủ công: React gắn sự kiện wheel ở chế độ thụ động
  // nên preventDefault trong onWheel không có tác dụng, và cả trang sẽ cuộn theo.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = atCursor(e)
      setCam(c => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.k * Math.exp(-e.deltaY * 0.0016)))
        const ratio = k / c.k
        // Giữ nguyên điểm dưới con trỏ: nó là chỗ người ta đang nhìn.
        return { k, x: p.x - (p.x - c.x) * ratio, y: p.y - (p.y - c.y) * ratio }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const shown = result ? Math.min(step, result.trace.length) : 0

  const frame = useMemo(() => {
    if (!tree?.nodes.length) return null
    const [xMin, yMin, xMax, yMax] = tree.bounds
    const pad = Math.max(1, (xMax - xMin + yMax - yMin) * 0.04)
    // Cây càng lớn thì nét càng phải mảnh, nếu không cả ô chỉ còn là một mảng
    // đặc. Cỡ chấm đo theo khoảng cách giữa hai tầng, luôn bằng 1 — không đo
    // theo khung bao, vì khung bao của cây sâu thì rộng ra mà các tầng vẫn cách
    // nhau đúng chừng ấy, chấm sẽ phình lên chồng đè lên nhau.
    //
    // Cũng không chia cho mức phóng. Chia là giữ chấm nguyên cỡ trên màn hình,
    // nghe thì hợp lý nhưng hoá ra sai hẳn mục đích: chấm ở mức vừa ô vốn đã bé
    // tới mức chỉ đủ thấy hình dạng chung, giữ nguyên cỡ ấy thì phóng lên mười
    // bốn lần vẫn không đọc thêm được gì, chỉ còn trơ mấy sợi chỉ. Để phép biến
    // hình phóng cả chấm lẫn nét thì tỉ lệ giữa chấm và khoảng cách hai tầng
    // không đổi ở mọi mức phóng — phóng tới đâu cũng ra một đồ thị đọc được.
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

  // Phần vẽ tách riêng và ghi nhớ lại: kéo hay phóng chỉ đổi một thuộc tính
  // transform, không đụng tới hàng trăm chấm bên trong. Thiếu chỗ này thì mỗi
  // lần nhích chuột React phải dựng lại toàn bộ cây, và tay kéo thấy giật.
  const body = useMemo(() => {
    if (!tree || !frame) return null
    const { dot, line } = frame
    const visible = tree.nodes.filter(t => t.order < shown)
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
  }, [tree, frame, onPath, shown])

  if (!result || !frame || !body)
    return <div className="tree-empty">Chạy thuật toán để thấy cây tìm kiếm.</div>

  const { box } = frame
  // Nút bấm phóng quanh tâm ô, không phải quanh gốc toạ độ — bấm phóng mà cây
  // trượt ra khỏi khung thì coi như nút không dùng được.
  const zoomBy = (factor: number) => setCam(c => {
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.k * factor))
    const ratio = k / c.k
    const mx = box.x + box.w / 2, my = box.y + box.h / 2
    return { k, x: mx - (mx - c.x) * ratio, y: my - (my - c.y) * ratio }
  })

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
        <button onClick={() => zoomBy(1 / 1.5)} title="Thu nhỏ">–</button>
        <span className="num">{cam.k < 10 ? cam.k.toFixed(1) : Math.round(cam.k)}×</span>
        <button onClick={() => zoomBy(1.5)} title="Phóng to">+</button>
        <button onClick={() => setCam(HOME)} title="Bấm đúp lên cây cũng về được vị trí này">Vừa ô</button>
      </div>
    </div>
  )
}
