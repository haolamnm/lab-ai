import { useMemo } from 'react'
import { explain, toExportable } from '../lib/explain'
import { algoOf } from '../lib/search'
import type { Conditions } from '../lib/traffic'
import { useStore } from '../store'

/**
 * Khối giải thích tuyến.
 *
 * Đề bài tách hẳn một mục riêng cho việc này: hệ thống không được chỉ trả ra
 * đường đi, mà phải nói được vì sao đường đó được chọn, nó thua tuyến khác ở
 * chỗ nào, đoạn nào đang kẹt, và kết quả có phải tối ưu không.
 *
 * Toàn bộ câu chữ dựng từ số liệu của lượt chạy hiện tại. Đổi khung giờ hay
 * kéo một thanh trọng số thì lời giải thích đổi theo ngay.
 */
export function Explain() {
  const graph = useStore(s => s.graph)
  const panes = useStore(s => s.panes)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const vehicle = useStore(s => s.vehicle)
  const period = useStore(s => s.period)
  const weights = useStore(s => s.weights)

  const conditions: Conditions = { vehicle, period, weights }

  const results = useMemo(
    () => panes.filter(p => p.result).map(p => ({ algo: algoOf(p.algo).name, result: p.result! })),
    [panes],
  )

  // Mã nút là chuỗi toạ độ, người đọc không hiểu — đổi về tên địa điểm đã chọn.
  const nameOf = useMemo(() => {
    const table = new Map<string, string>()
    if (start?.nodeId) table.set(start.nodeId, start.place.name)
    if (goal?.nodeId) table.set(goal.nodeId, goal.place.name)
    stops.forEach(s => { if (s.nodeId) table.set(s.nodeId, s.place.name) })
    return (id: string) => table.get(id) ?? 'nút giao'
  }, [start, goal, stops])

  const info = useMemo(
    () => (graph ? explain(graph, results, conditions, nameOf) : null),
    [graph, results, vehicle, period, weights, nameOf],
  )

  const blocked = panes.find(p => p.result?.problem)?.result?.problem
  if (blocked) return <div className="explain"><p className="explain-blocked">{blocked}</p></div>
  if (!info || !graph) return null

  const download = () => {
    const blob = new Blob(
      [JSON.stringify(toExportable(graph, results, conditions), null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'route-lab-du-lieu.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="explain">
      <header className="explain-head">
        <h2>Vì sao chọn tuyến này</h2>
        <button className="button" onClick={download} title="Lưu mạng lưới và kết quả ra file JSON">
          Xuất dữ liệu
        </button>
      </header>

      <div className="explain-body">
        <p className="explain-lead">
          {info.headline}
          {info.titles.length > 0 && <> Trong các thuật toán đang chạy, đây là tuyến {info.titles.join(', ')}.</>}
        </p>

        {info.order && (
          <p className="explain-row"><b>Thứ tự ghé</b> {info.order}</p>
        )}

        {info.jams.length > 0 && (
          <p className="explain-row">
            <b>Đoạn đông nhất trên tuyến</b>{' '}
            {info.jams.map(j => (
              <span className="jam" key={j.name}>
                {j.name} · <span className="num">{j.km.toFixed(2)}</span> km ·
                kẹt <span className="num">{j.congestion}</span>/5 ·
                mất <span className="num">{j.minutes.toFixed(1)}</span> phút
              </span>
            ))}
          </p>
        )}

        {info.rivals.length > 0 && (
          <p className="explain-row">
            <b>So với phương án khác</b>{' '}
            {info.rivals.map(r => (
              <span className="rival" key={r.algo}>{r.algo} {r.verdict}</span>
            ))}
          </p>
        )}

        <p className="explain-row"><b>Tính tối ưu</b> {info.optimality}</p>
      </div>
    </section>
  )
}
