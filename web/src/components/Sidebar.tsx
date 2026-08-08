import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Icon, VEHICLE_ICON, type IconName } from '../icons'
import { useStore } from '../store'
import { areaProblem, DETAIL_LABEL } from '../lib/overpass'
import { SAMPLE_CASES } from '../lib/sampleCases'
import { costIsFlat, CRITERIA, PERIODS, traitsOf, VEHICLES } from '../lib/traffic'
import type { CriterionKey, Detail, PeriodKey, VehicleKey, Weights } from '../lib/types'
import { HeldKarpNotice } from './HeldKarpNotice'
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
    buildNote: st.buildNote, sample: st.sample, sampleCase: st.sampleCase,
    running: st.running, runError: st.runError,
    period: st.period, vehicle: st.vehicle, criterion: st.criterion,
    weights: st.weights, optimiseOrder: st.optimiseOrder,
    returnToStart: st.returnToStart,
    setPlace: st.setPlace, addStop: st.addStop, removeStop: st.removeStop,
    setDetail: st.setDetail, build: st.build, loadSample: st.loadSample,
    importGraph: st.importGraph, setPeriod: st.setPeriod, setVehicle: st.setVehicle,
    setCriterion: st.setCriterion, setWeight: st.setWeight,
    setOptimiseOrder: st.setOptimiseOrder, setReturnToStart: st.setReturnToStart,
    run: st.run,
  })))
  // Deliberately not part of the object above. `panes` is rewritten once per pane
  // per result as a run lands, and including it re-rendered every section of the
  // sidebar each time — while the count is all this component ever reads from it.
  const paneCount = useStore(st => st.panes.length)
  const [adding, setAdding] = useState(false)
  const [cases, setCases] = useState(false)
  const vehicle = VEHICLES[s.vehicle]
  const { start, goal } = s
  const nodeCount = s.graph ? Object.keys(s.graph.nodes).length : 0

  // Warn about an oversized area as soon as both points are picked — don't wait for
  // the build click. Destructured above because narrowing through `s.start` does not
  // survive into a mutable object property, so a `ready` boolean could not carry it.
  const oversize = start && goal
    ? areaProblem([start.place, ...s.stops.map(x => x.place), goal.place], s.detail)
    : null

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-scroll">

        <section className="block">
          <h2>Trip</h2>
          <PlaceField
            role="Pickup" kind="start" placeholder="Pickup location" value={s.start}
            onPick={p => s.setPlace('start', p)} onClear={() => s.setPlace('start', null)}
          />
          {s.stops.map((stop, i) => (
            <div className="stop-row" key={`${stop.place.lat},${stop.place.lng}`}>
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
          {/* On a round trip the dropoff is not where the trip ends -- a loop has
              no last stop -- so it is labelled as the ordinary stop it becomes.
              Relabelled in place rather than moved into the stop list above,
              because unticking has to give it straight back. */}
          <PlaceField
            role={s.returnToStart ? 'Stop' : 'Dropoff'} kind="goal"
            placeholder={s.returnToStart ? 'Another stop' : 'Dropoff location'} value={s.goal}
            onPick={p => s.setPlace('goal', p)} onClear={() => s.setPlace('goal', null)}
          />
          <label className="field-row">
            <span>Round trip</span>
            <input
              type="checkbox" checked={s.returnToStart}
              onChange={e => s.setReturnToStart(e.target.checked)}
            />
          </label>
          {s.returnToStart && (
            <p className="note lift">
              Returns to the pickup after the last stop. Every algorithm plans the
              loop; the ordering ones choose where the dropoff falls in it.
            </p>
          )}
          {s.stops.length > 0 && (
            <label className="field-row">
              <span>Optimise visit order</span>
              <input
                type="checkbox" checked={s.optimiseOrder}
                onChange={e => s.setOptimiseOrder(e.target.checked)}
              />
            </label>
          )}
          <HeldKarpNotice />
        </section>

        <section className="block">
          <h2>Road network</h2>
          <Segment
            label="Road network detail level"
            value={s.detail}
            // Two rows of two. Four labels of "Medium roads" length need 400px
            // side by side and the sidebar gives 307, so in one row the fourth
            // option — "With alleys" — was pushed past the edge and clipped
            // away entirely: present in the DOM, reachable by keyboard, and
            // invisible to anyone using a mouse.
            columns={2}
            onChange={(d: Detail) => s.setDetail(d)}
            options={(Object.keys(DETAIL_LABEL) as Detail[]).map(d => ({
              value: d, label: DETAIL_LABEL[d],
              icon: <Icon name={DETAIL_ICON[d]} size={17} solid={s.detail === d} />,
            }))}
          />
          <button
            className={`button wide${s.building ? ' busy' : ''}`}
            disabled={!start || !goal || s.building || !!oversize}
            onClick={() => s.build()}
          >
            {s.building ? 'Loading roads from OpenStreetMap…' : s.graph ? 'Rebuild network' : 'Build network'}
          </button>

          <div className="pair">
            {/* A disclosure, not a plain action. The list of scenarios is seven
                paragraphs tall — long enough that leaving it open permanently
                would push the conditions and the weight sliders below the fold
                for the whole session, and it is only read when you are choosing
                a scenario. So the button that reveals it also puts it away.
                Pressing it with no sample loaded loads the first scenario as
                well, since an empty list would be nothing to open. */}
            <button
              className="button"
              aria-expanded={cases}
              aria-controls="sample-cases"
              onClick={() => {
                if (!s.sample) s.loadSample()
                setCases(o => !o)
              }}
            >
              Sample graph
              <span className="button-caret" aria-hidden="true">{cases ? '▴' : '▾'}</span>
            </button>
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
          {/* Each scenario sets the whole situation — trip, vehicle, hour and
              criterion — and says what it is there to show. Gated on the sample
              network being loaded as well as on the disclosure: every case is a
              trip across that particular network, so none of them means anything
              once Build network has replaced it with OpenStreetMap data. */}
          {cases && s.sample && (
            <div className="cases" id="sample-cases" role="group" aria-label="Sample scenario">
              {Object.values(SAMPLE_CASES).map(c => (
                <button
                  key={c.key}
                  className="case"
                  aria-pressed={s.sampleCase === c.key}
                  onClick={() => s.loadSample(c.key)}
                >
                  <b>{c.name}</b>
                  <small>{c.about}</small>
                </button>
              ))}
            </div>
          )}
          {s.detail === 'alleys' && (
            <p className="note lift">
              Also loads the alley network — passable only by motorbike. The graph gets about
              three times heavier, so this only works for trips under ~3 km.
            </p>
          )}
          {(!start || !goal) && <p className="note">Pick a pickup and dropoff first.</p>}
          {oversize && <p className="note warn">{oversize}</p>}
          {s.buildError && !oversize && <p className="note warn">{s.buildError}</p>}
          {s.buildNote && !s.building && (
            <p className="note lift">{s.buildNote}</p>
          )}
          {s.graph && !s.building && !oversize && (
            <p className="note">
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
            options={Object.values(PERIODS).map(p => ({
              value: p.key, label: p.name, hue: p.hue,
              icon: <Icon name={PERIOD_ICON[p.key]} size={17} solid={s.period === p.key} />,
            }))}
          />
          <Segment
            label="Delivery vehicle"
            value={s.vehicle}
            stacked
            onChange={(v: VehicleKey) => s.setVehicle(v)}
            options={Object.values(VEHICLES).map(v => ({
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
          <p className="note">{vehicle.weakness}.</p>
        </section>

        <section className="block">
          <h2>Criterion</h2>
          <Segment
            label="Optimisation criterion"
            value={s.criterion}
            columns={2}
            onChange={(c: CriterionKey) => s.setCriterion(c)}
            options={(Object.keys(CRITERIA) as Exclude<CriterionKey, 'custom'>[])
              .map(c => ({ value: c as CriterionKey, label: CRITERIA[c].name }))}
          />
          {s.criterion === 'custom' && (
            <p className="note">Using the custom weights below.</p>
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
              algorithm to optimise. Drag at least one slider above 0.
            </p>
          )}
        </section>
      </div>

      <div className="sidebar-foot">
        <button
          className={`button solid wide${s.running ? ' busy' : ''}`}
          disabled={s.running || !s.graph || !paneCount || !s.start?.nodeId || !s.goal?.nodeId}
          onClick={() => s.run()}
        >
          {s.running ? 'Planning on the backend…' : 'Run algorithms'}
        </button>
        {s.runError && <p className="note warn">{s.runError}</p>}
        <p className="note">
          {!s.graph
            ? 'Build the network before running.'
            : !paneCount
              ? 'Add at least one pane.'
              : `${paneCount} panes comparing.`}
        </p>
      </div>
    </aside>
  )
}
