import { useMemo, useState } from 'react'
import { Icon, type IconName } from '../icons'
import { snap } from '../lib/overpass'
import { algoOf, planRoute } from '../lib/search'
import { banReason, passable, periodOf, VEHICLES } from '../lib/traffic'
import type { VehicleKey } from '../lib/types'
import { useStore } from '../store'

const VEHICLE_ICON: Record<VehicleKey, IconName> = {
  bike: 'scooter', van: 'van', car: 'car', truck: 'truck',
}
/** Nhóm tuyến đặt tên bằng chữ cái, để nhìn ra ngay xe nào đi chung đường. */
const GROUP = ['A', 'B', 'C', 'D']

/**
 * Bảng so sánh bốn loại xe.
 *
 * Lưới màn hình so sánh **thuật toán**: mỗi ô một thuật toán, cùng một hành
 * trình. Loại xe thì ngược lại — nó là lựa chọn chung của cả lưới, nên trước đây
 * muốn biết xe tải đi khác xe máy chỗ nào thì phải bấm đổi xe rồi tự nhớ lấy con
 * số cũ. Bảng này chạy cả bốn xe một lượt, giữ nguyên thuật toán, khung giờ và
 * trọng số đang đặt.
 *
 * Không phải đổi xe rồi chạy lại bốn lần là vì mỗi loại xe **ghim vào một nút
 * giao khác nhau**: chỗ xe máy dừng được chưa chắc xe tải rời đi được. Bảng phải
 * tự ghim lại cho từng xe, nếu không nó so hai thứ khác nhau.
 *
 * Chỉ tính khi người dùng mở ra, vì mỗi lần tính là bốn lượt tìm kiếm đầy đủ —
 * để nó chạy nền theo mỗi cái nhích thanh trọng số thì cả giao diện sẽ giật.
 */
export function Compare() {
  const graph = useStore(s => s.graph)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const period = useStore(s => s.period)
  const weights = useStore(s => s.weights)
  const vehicle = useStore(s => s.vehicle)
  const panes = useStore(s => s.panes)
  const optimiseOrder = useStore(s => s.optimiseOrder)
  const setVehicle = useStore(s => s.setVehicle)

  const [open, setOpen] = useState(false)
  const algo = panes[0]?.algo ?? 'astar'

  const rows = useMemo(() => {
    if (!open || !graph || !start || !goal) return null
    return VEHICLES.map(v => {
      const usable = (id: string) => (graph.adj[id] ?? []).some(e => passable(e, v.key, period))
      const from = snap(graph, start.place, usable)
      const to = snap(graph, goal.place, usable)
      const result = planRoute({
        graph, algo,
        start: from.nodeId, goal: to.nodeId,
        stops: stops.map(x => snap(graph, x.place, usable).nodeId),
        optimiseOrder,
        conditions: { vehicle: v.key, period, weights },
      })
      // Đếm cạnh bị cấm để thấy loại xe này bị bó hẹp tới mức nào, và vì sao.
      // Gom mọi lý do chứ không lấy cái đầu tiên: lệnh cấm cả ngày luôn gặp
      // trước, nên lấy cái đầu là giờ cấm tải không bao giờ được nhắc tới.
      let blocked = 0
      const why = new Set<string>()
      for (const e of graph.edges) {
        const r = banReason(e, v.key, period)
        if (r) { blocked++; why.add(r) }
      }
      return { v, result, blocked, reason: [...why].join('. '), snapped: Math.max(from.metres, to.metres) }
    })
  }, [open, graph, algo, period, weights, start, goal, stops, optimiseOrder])

  // Xe nào đi chung một tuyến thì mang chung một chữ cái.
  const groupOf = useMemo(() => {
    const seen = new Map<string, number>()
    return (path: string[]) => {
      const k = path.join('>')
      if (!k) return '—'
      if (!seen.has(k)) seen.set(k, seen.size)
      return GROUP[seen.get(k)!] ?? '?'
    }
  }, [rows])

  if (!graph || !start || !goal) return null

  return (
    <section className="compare">
      <button className="compare-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="compare-title">So sánh phương tiện</span>
        <span className="compare-sub">
          {algoOf(algo).name} · {periodOf(period).name.toLowerCase()}
        </span>
        <span className="compare-caret" data-open={open}>{open ? 'Thu lại' : 'Mở ra'}</span>
      </button>

      {open && rows && (
        <div className="compare-body">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Xe</th>
                <th className="r">Quãng đường</th>
                <th className="r">Thời gian</th>
                <th className="r">Chi phí</th>
                <th className="r">Cạnh bị cấm</th>
                <th className="r">Cấm rẽ chặn</th>
                <th className="r">Ghim xa nhất</th>
                <th>Tuyến</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, result, blocked, reason, snapped }) => {
                const m = result.metrics
                return (
                  <tr key={v.key} data-on={v.key === vehicle}>
                    <th scope="row">
                      <button className="compare-pick" onClick={() => setVehicle(v.key)} title={`Chuyển sang ${v.name}`}>
                        <Icon name={VEHICLE_ICON[v.key]} size={17} solid={v.key === vehicle} />
                        {v.name}
                      </button>
                    </th>
                    {result.found ? (
                      <>
                        <td className="r num">{m.km.toFixed(2)} km</td>
                        <td className="r num">{m.minutes} phút</td>
                        <td className="r num">{m.cost.toFixed(1)}</td>
                        <td className="r num" title={reason || 'Không bị cấm cấp đường nào'}>
                          {blocked ? `${blocked}/${graph.edges.length}` : '—'}
                        </td>
                        <td className="r num">{m.turnsBlocked || '—'}</td>
                        <td className="r num">{snapped} m</td>
                        <td><span className="compare-group">{groupOf(result.path)}</span></td>
                      </>
                    ) : (
                      <td className="fail" colSpan={7}>{result.problem ?? 'không tới được'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 9 }}>
            Cùng chữ cái ở cột <b>Tuyến</b> nghĩa là đi trùng đường. Cột <b>Cạnh bị cấm</b> tính cả
            giờ cấm tải, nên đổi khung giờ là con số đổi theo. Bấm tên xe để chuyển cả lưới sang xe đó.
          </p>
        </div>
      )}
    </section>
  )
}
