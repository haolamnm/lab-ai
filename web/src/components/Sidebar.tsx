import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Icon, VEHICLE_ICON, type IconName } from '../icons'
import { useStore } from '../store'
import { areaProblem, DETAIL_LABEL } from '../lib/overpass'
import { costIsFlat, CRITERIA, PERIODS, traitsOf, VEHICLES, vehicleOf } from '../lib/traffic'
import type { CriterionKey, Detail, PeriodKey, VehicleKey, Weights } from '../lib/types'
import { PlaceField } from './PlaceField'
import { Segment } from './Segment'

const WEIGHT_LABEL: Record<keyof Weights, string> = {
  distance: 'Distance',
  time: 'Time',
  congestion: 'Congestion',
  risk: 'Risk',
}

const PERIOD_ICON: Record<PeriodKey, IconName> = {
  peak: 'peak', offpeak: 'offpeak', night: 'night',
}
const DETAIL_ICON: Record<Detail, IconName> = {
  coarse: 'trunkRoads', medium: 'midRoads', fine: 'smallRoads', alleys: 'alleys',
}

export function Sidebar() {
  // Pick the fields explicitly rather than subscribing to the whole store. The
  // sidebar reads none of the timeline state, but a bare useStore() would still
  // re-render all of it — every section, every segmented control — on each of
  // the ~3 steps per second the timeline emits while a run plays back.
  const s = useStore(useShallow(st => ({
    graph: st.graph, start: st.start, goal: st.goal, stops: st.stops,
    detail: st.detail, building: st.building, buildError: st.buildError,
    buildNote: st.buildNote, sample: st.sample, panes: st.panes,
    period: st.period, vehicle: st.vehicle, criterion: st.criterion,
    weights: st.weights, optimiseOrder: st.optimiseOrder,
    setPlace: st.setPlace, addStop: st.addStop, removeStop: st.removeStop,
    setDetail: st.setDetail, build: st.build, loadSample: st.loadSample,
    importGraph: st.importGraph, setPeriod: st.setPeriod, setVehicle: st.setVehicle,
    setCriterion: st.setCriterion, setWeight: st.setWeight,
    setOptimiseOrder: st.setOptimiseOrder, run: st.run,
  })))
  const [adding, setAdding] = useState(false)
  const vehicle = vehicleOf(s.vehicle)
  const ready = !!s.start && !!s.goal
  const nodeCount = s.graph ? Object.keys(s.graph.nodes).length : 0

  // Warn about an oversized area as soon as both points are picked — don't wait for the build click.
  const oversize = ready
    ? areaProblem([s.start!.place, ...s.stops.map(x => x.place), s.goal!.place], s.detail)
    : null

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">

        <section className="block">
          <h2>Trip</h2>
          <PlaceField
            role="Pickup" kind="start" placeholder="Pickup location" value={s.start}
            onPick={p => s.setPlace('start', p)} onClear={() => s.setPlace('start', null)}
          />
          {s.stops.map((stop, i) => (
            <div className="stop-row" key={`${stop.place.lat}-${i}`}>
              <span>{stop.place.name}</span>
              <button onClick={() => s.removeStop(i)} aria-label="Remove this stop">Remove</button>
            </div>
          ))}
          {adding ? (
            <PlaceField
              role="Stop" kind="stop" placeholder="Add a stop" autoFocus
              onPick={p => { s.addStop(p); setAdding(false) }}
              onClear={() => setAdding(false)}
            />
          ) : (
            <button className="link-button" onClick={() => setAdding(true)}>Add a stop</button>
          )}
          <div style={{ height: 8 }} />
          <PlaceField
            role="Dropoff" kind="goal" placeholder="Dropoff location" value={s.goal}
            onPick={p => s.setPlace('goal', p)} onClear={() => s.setPlace('goal', null)}
          />
          {s.stops.length > 1 && (
            <label className="field-row" style={{ marginTop: 10 }}>
              <span>Optimize visit order</span>
              <input
                type="checkbox" checked={s.optimiseOrder}
                onChange={e => s.setOptimiseOrder(e.target.checked)}
              />
            </label>
          )}
        </section>

        <section className="block">
          <h2>Road network</h2>
          <Segment
            label="Road network detail level"
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
            {s.building ? 'Loading roads from OpenStreetMap…' : s.graph ? 'Rebuild network' : 'Build network'}
          </button>

          <div className="pair">
            <button className="button" onClick={() => s.loadSample()}>Sample graph</button>
            <label className="button as-label">
              Import file
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
              Using a custom-designed graph: one letter per node, small enough to trace step by step.
              Click Build network to go back to OpenStreetMap data.
            </p>
          )}
          {s.detail === 'alleys' && (
            <p className="note lift" style={{ marginTop: 8 }}>
              Also loads the alley network — passable only by motorbike. The graph gets about
              three times heavier, so this only works for trips under ~3 km.
            </p>
          )}
          {!ready && <p className="note" style={{ marginTop: 8 }}>Pick a pickup and dropoff first.</p>}
          {oversize && <p className="note warn" style={{ marginTop: 8 }}>{oversize}</p>}
          {s.buildError && !oversize && <p className="note warn" style={{ marginTop: 8 }}>{s.buildError}</p>}
          {s.buildNote && !s.building && (
            <p className="note lift" style={{ marginTop: 8 }}>{s.buildNote}</p>
          )}
          {s.graph && !s.building && !oversize && (
            <p className="note" style={{ marginTop: 8 }}>
              <span className="num">{nodeCount}</span> intersections,{' '}
              <span className="num">{s.graph.edges.length}</span> road segments.
              {nodeCount > 900 && ' Large network, so the animation will be long and run slowly. Lower the detail level if you need to record a video.'}
            </p>
          )}
        </section>

        <section className="block">
          <h2>Conditions</h2>
          <Segment
            label="Time period"
            value={s.period}
            onChange={(p: PeriodKey) => s.setPeriod(p)}
            options={PERIODS.map(p => ({
              value: p.key, label: p.name, hue: p.hue,
              icon: <Icon name={PERIOD_ICON[p.key]} size={17} solid={s.period === p.key} />,
            }))}
          />
          <div style={{ height: 10 }} />
          <Segment
            label="Delivery vehicle"
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
                  <span className="pips" aria-label={`${t.value} of 5`}>
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
          <h2>Criterion</h2>
          <Segment
            label="Optimization criterion"
            value={s.criterion}
            columns={2}
            onChange={(c: CriterionKey) => s.setCriterion(c)}
            options={(Object.keys(CRITERIA) as Exclude<CriterionKey, 'custom'>[])
              .map(c => ({ value: c as CriterionKey, label: CRITERIA[c].name }))}
          />
          {s.criterion === 'custom' && (
            <p className="note" style={{ marginTop: 10 }}>Using the custom weights below.</p>
          )}
        </section>

        <section className="block">
          <h2>Cost weights</h2>
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
              All four are at 0, so every route costs 0 and there's nothing left for any
              algorithm to optimize. Drag at least one slider above 0.
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
          Run algorithms
        </button>
        <p className="note">
          {!s.graph
            ? 'Build the network before running.'
            : !s.panes.length
              ? 'Add at least one pane.'
              : `${s.panes.length} panes comparing.`}
        </p>
      </div>
    </aside>
  )
}
