import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Icon, type IconName } from '../icons'
import { useStore } from '../store'
import { areaProblem, DETAIL_LABEL } from '../lib/overpass'
import { costIsFlat, CRITERIA, PERIODS, traitsOf, VEHICLES, vehicleOf } from '../lib/traffic'
import type { CriterionKey, Detail, PeriodKey, VehicleKey, Weights } from '../lib/types'
import { PlaceField } from './PlaceField'
import { Segment } from './Segment'

const WEIGHT_LABEL: Record<keyof Weights, string> = {
  distance: 'Quãng đường',
  time: 'Thời gian',
  congestion: 'Mức kẹt xe',
  risk: 'Rủi ro',
}

const VEHICLE_ICON: Record<VehicleKey, IconName> = {
  bike: 'scooter', van: 'van', car: 'car', truck: 'truck',
}
const PERIOD_ICON: Record<PeriodKey, IconName> = {
  peak: 'peak', offpeak: 'offpeak', night: 'night',
}
const DETAIL_ICON: Record<Detail, IconName> = {
  coarse: 'trunkRoads', medium: 'midRoads', fine: 'smallRoads', alleys: 'alleys',
}

export function Sidebar() {
  const s = useStore()
  const [adding, setAdding] = useState(false)
  const vehicle = vehicleOf(s.vehicle)
  const ready = !!s.start && !!s.goal
  const nodeCount = s.graph ? Object.keys(s.graph.nodes).length : 0

  // Cảnh báo vùng quá rộng ngay khi chọn xong hai điểm, không đợi bấm dựng.
  const oversize = ready
    ? areaProblem([s.start!.place, ...s.stops.map(x => x.place), s.goal!.place], s.detail)
    : null

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">

        <section className="block">
          <h2>Hành trình</h2>
          <PlaceField
            role="Lấy" placeholder="Điểm lấy hàng" value={s.start}
            onPick={p => s.setPlace('start', p)} onClear={() => s.setPlace('start', null)}
          />
          {s.stops.map((stop, i) => (
            <div className="stop-row" key={`${stop.place.lat}-${i}`}>
              <span>{stop.place.name}</span>
              <button onClick={() => s.removeStop(i)} aria-label="Bỏ điểm giao này">Bỏ</button>
            </div>
          ))}
          {adding ? (
            <PlaceField
              role="Ghé" placeholder="Điểm giao thêm" autoFocus
              onPick={p => { s.addStop(p); setAdding(false) }}
              onClear={() => setAdding(false)}
            />
          ) : (
            <button className="link-button" onClick={() => setAdding(true)}>Thêm điểm giao</button>
          )}
          <div style={{ height: 8 }} />
          <PlaceField
            role="Giao" placeholder="Điểm giao cuối" value={s.goal}
            onPick={p => s.setPlace('goal', p)} onClear={() => s.setPlace('goal', null)}
          />
          {s.stops.length > 1 && (
            <label className="field-row" style={{ marginTop: 10 }}>
              <span>Tự sắp thứ tự ghé</span>
              <input
                type="checkbox" checked={s.optimiseOrder}
                onChange={e => s.setOptimiseOrder(e.target.checked)}
              />
            </label>
          )}
        </section>

        <section className="block">
          <h2>Mạng lưới đường</h2>
          <Segment
            label="Mức chi tiết mạng lưới"
            value={s.detail}
            onChange={(d: Detail) => s.setDetail(d)}
            options={(Object.keys(DETAIL_LABEL) as Detail[]).map(d => ({
              value: d, label: DETAIL_LABEL[d],
              icon: <Icon name={DETAIL_ICON[d]} size={17} solid={s.detail === d} />,
            }))}
          />
          <div style={{ height: 10 }} />
          <button
            className={`button wide${s.building ? ' busy' : ''}`}
            disabled={!ready || s.building || !!oversize}
            onClick={() => s.build()}
          >
            {s.building ? 'Đang tải đường từ OpenStreetMap…' : s.graph ? 'Dựng lại mạng lưới' : 'Dựng mạng lưới'}
          </button>

          <div className="pair">
            <button className="button" onClick={() => s.loadSample()}>Đồ thị mẫu</button>
            <label className="button as-label">
              Nhập file
              <input
                type="file" accept="application/json" hidden
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) s.importGraph(await f.text())
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {s.sample && (
            <p className="note lift" style={{ marginTop: 8 }}>
              Đang dùng đồ thị tự thiết kế: mỗi nút một chữ cái, đủ nhỏ để dò từng bước bằng mắt.
              Bấm Dựng mạng lưới để quay lại dữ liệu OpenStreetMap.
            </p>
          )}
          {s.detail === 'alleys' && (
            <p className="note lift" style={{ marginTop: 8 }}>
              Nạp thêm mạng hẻm — thứ chỉ xe máy đi được. Đồ thị nặng gấp khoảng ba lần
              nên chỉ chạy được với quãng dưới ~3 km.
            </p>
          )}
          {!ready && <p className="note" style={{ marginTop: 8 }}>Chọn điểm lấy hàng và điểm giao trước.</p>}
          {oversize && <p className="note warn" style={{ marginTop: 8 }}>{oversize}</p>}
          {s.buildError && !oversize && <p className="note warn" style={{ marginTop: 8 }}>{s.buildError}</p>}
          {s.buildNote && !s.building && (
            <p className="note lift" style={{ marginTop: 8 }}>{s.buildNote}</p>
          )}
          {s.graph && !s.building && !oversize && (
            <p className="note" style={{ marginTop: 8 }}>
              <span className="num">{nodeCount}</span> nút giao,{' '}
              <span className="num">{s.graph.edges.length}</span> đoạn đường.
              {nodeCount > 900 && ' Mạng lưới lớn nên hoạt ảnh sẽ dài và chạy chậm. Giảm mức chi tiết nếu cần quay video.'}
            </p>
          )}
        </section>

        <section className="block">
          <h2>Điều kiện</h2>
          <Segment
            label="Khung giờ"
            value={s.period}
            onChange={(p: PeriodKey) => s.setPeriod(p)}
            options={PERIODS.map(p => ({
              value: p.key, label: p.name, hue: p.hue,
              icon: <Icon name={PERIOD_ICON[p.key]} size={17} solid={s.period === p.key} />,
            }))}
          />
          <div style={{ height: 10 }} />
          <Segment
            label="Phương tiện giao hàng"
            value={s.vehicle}
            stacked
            onChange={(v: VehicleKey) => s.setVehicle(v)}
            options={VEHICLES.map(v => ({
              value: v.key,
              label: v.name,
              title: `${v.name} — ${v.strength}`,
              icon: <Icon name={VEHICLE_ICON[v.key]} size={21} solid={s.vehicle === v.key} />,
            }))}
          />
          <dl className="meters">
            {traitsOf(s.vehicle).map(t => (
              <div className="meter" key={t.name} title={t.hint}>
                <dt>{t.name}</dt>
                <dd>
                  <span className="pips" aria-label={`${t.value} trên 5`}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <i key={i} data-on={i <= t.value} style={{ background: i <= t.value ? t.hue : undefined }} />
                    ))}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="note" style={{ marginTop: 10 }}>{vehicle.weakness}.</p>
        </section>

        <section className="block">
          <h2>Tiêu chí</h2>
          <Segment
            label="Tiêu chí tối ưu"
            value={s.criterion}
            columns={2}
            onChange={(c: CriterionKey) => s.setCriterion(c)}
            options={(Object.keys(CRITERIA) as Exclude<CriterionKey, 'custom'>[])
              .map(c => ({ value: c as CriterionKey, label: CRITERIA[c].name }))}
          />
          {s.criterion === 'custom' && (
            <p className="note" style={{ marginTop: 10 }}>Đang dùng trọng số tự chỉnh bên dưới.</p>
          )}
        </section>

        <section className="block">
          <h2>Trọng số chi phí</h2>
          {(Object.keys(WEIGHT_LABEL) as (keyof Weights)[]).map(k => (
            <div className="weight" data-w={k} key={k}>
              <div className="weight-head">
                <span>{WEIGHT_LABEL[k]}</span>
                <b className="num">{s.weights[k].toFixed(2)}</b>
              </div>
              <input
                type="range" min={0} max={3} step={0.05} value={s.weights[k]}
                onChange={e => s.setWeight(k, +e.target.value)}
                aria-label={WEIGHT_LABEL[k]}
                style={{ '--fill': `${(s.weights[k] / 3) * 100}%` } as CSSProperties}
              />
            </div>
          ))}
          {costIsFlat(s.weights) && (
            <p className="note warn">
              Cả bốn đang bằng 0, nên mọi tuyến đều có chi phí 0 và không thuật toán nào
              còn gì để tối ưu. Kéo ít nhất một thanh lên khỏi 0.
            </p>
          )}
        </section>
      </div>

      <div className="sidebar-foot">
        <button
          className="button solid wide"
          disabled={!s.graph || !s.panes.length || !s.start?.nodeId || !s.goal?.nodeId}
          onClick={() => s.run()}
        >
          Chạy thuật toán
        </button>
        <p className="note">
          {!s.graph
            ? 'Dựng mạng lưới trước khi chạy.'
            : !s.panes.length
              ? 'Thêm ít nhất một màn hình.'
              : `${s.panes.length} màn hình đang so sánh.`}
        </p>
      </div>
    </aside>
  )
}
