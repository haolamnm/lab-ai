import { useEffect, useMemo, useState } from 'react'
import { exposureOn } from '../lib/explain'
import { backendEnabled, planRouteRemote } from '../lib/planClient'
import { algoOf, planRoute, type PlanInput } from '../lib/search'
import { CRITERIA, periodOf, vehicleOf } from '../lib/traffic'
import type { CriterionKey, RouteResult, Weights } from '../lib/types'
import { useStore } from '../store'

/** Same idea as the vehicle table: one letter per distinct route. */
const GROUP = ['A', 'B', 'C', 'D', 'E']

/** Long enough that dragging a weight slider across its range costs one run, not thirty. */
const SETTLE_MS = 350

interface Row {
  key: CriterionKey
  name: string
  weights: Weights
  result: RouteResult
  /** The four ranked columns, flattened onto the row so a cell can read one by
   *  name. They arrive from two places — distance and time are the run's own
   *  metrics, congestion and risk are the length-weighted exposure of the route
   *  it actually crossed — and the table has no reason to care which. */
  km: number
  minutes: number
  congestion: number
  risk: number
}

/** The four physical columns, where less is better and the winner can be marked. */
const RANKED = ['km', 'minutes', 'congestion', 'risk'] as const
type Ranked = (typeof RANKED)[number]

/**
 * The cost-function comparison table.
 *
 * The brief asks for a route to be justified against the criteria it was
 * optimised for, and until now the app could only ever show one criterion at a
 * time: picking "Fastest" replaced the weights, cleared the results, and threw
 * away everything the previous criterion had found. Answering "how much longer
 * is the fast route?" meant switching back and forth and holding four numbers
 * in your head, which is exactly the comparison the two tables above already
 * do for algorithms and vehicles. This is the missing third axis.
 *
 * Every row is the same trip, the same vehicle, the same hour and the same
 * algorithm. The only thing that changes between rows is the cost function.
 *
 * The **Cost** column is deliberately not ranked. Each row's cost is measured
 * by its own weights, so the numbers are in four different units — "Shortest"
 * scores in kilometres while "Fastest" scores in minutes — and marking a
 * smallest one would be comparing a length against a duration and declaring a
 * winner. The four columns to its left are physical quantities measured the
 * same way for every row, so those are the ones that can be ranked, and they
 * are where the trade-off actually shows: the shortest route is rarely the
 * fastest, and the one that dodges congestion is usually neither.
 */
export function CompareCriteria() {
  const graph = useStore(s => s.graph)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const period = useStore(s => s.period)
  const vehicle = useStore(s => s.vehicle)
  const weights = useStore(s => s.weights)
  const criterion = useStore(s => s.criterion)
  const panes = useStore(s => s.panes)
  const optimiseOrder = useStore(s => s.optimiseOrder)
  const setCriterion = useStore(s => s.setCriterion)

  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const algo = panes[0]?.algo ?? 'astar'

  // Held–Karp has no browser implementation, so with no backend configured there
  // is nothing this table could run for it.
  const unsupported = algo === 'held_karp' && !backendEnabled

  // The presets, plus the user's own weights as a row of their own whenever they
  // have moved a slider. Dropping the custom row would mean the table silently
  // stopped describing the route on screen the moment anyone touched a slider.
  const plans = useMemo(() => {
    const presets = Object.entries(CRITERIA)
      .map(([key, preset]) => ({ key: key as CriterionKey, name: preset.name, weights: preset.weights }))
    if (criterion !== 'custom') return presets
    return [...presets, { key: 'custom' as CriterionKey, name: 'Custom', weights }]
  }, [criterion, weights])

  useEffect(() => {
    if (!open || unsupported || !graph || !start?.nodeId || !goal?.nodeId) {
      setRows(null)
      setError(null)
      setBusy(false)
      return
    }

    // Unlike the vehicle table, the pins do not move between rows: the vehicle
    // and the hour are held fixed here, and those are the only two things a pin
    // depends on. So this re-uses the anchors already in state rather than
    // re-snapping, and every row is guaranteed to start and end at the exact
    // nodes the panes above are using.
    const from = start.nodeId
    const to = goal.nodeId
    const via = stops.map(x => x.nodeId).filter((x): x is string => !!x)

    let live = true
    setBusy(true)
    const timer = setTimeout(() => {
      const plan = (w: Weights) => {
        const input: PlanInput = {
          graph, algo, start: from, goal: to, stops: via, optimiseOrder,
          conditions: { vehicle, period, weights: w },
        }
        return backendEnabled ? planRouteRemote(input) : Promise.resolve(planRoute(input))
      }

      Promise.all(plans.map(p => plan(p.weights).then(result => ({
        ...p,
        result,
        km: result.metrics.km,
        minutes: result.metrics.minutes,
        ...exposureOn(graph, result.path),
      }))))
        .then(next => {
          if (!live) return
          setRows(next)
          setError(null)
          setBusy(false)
        })
        .catch((e: unknown) => {
          if (!live) return
          setRows(null)
          setError(`Could not reach the planning backend: ${(e as Error).message}`)
          setBusy(false)
        })
    }, SETTLE_MS)

    return () => { live = false; clearTimeout(timer) }
  }, [open, unsupported, graph, algo, vehicle, period, start, goal, stops, optimiseOrder, plans])

  // The winning value in each ranked column, over the rows that found a route.
  const best = useMemo(() => {
    const out: Partial<Record<Ranked, number>> = {}
    if (!rows) return out
    for (const column of RANKED) {
      const values = rows.filter(r => r.result.found).map(r => r[column])
      if (values.length > 1) out[column] = Math.min(...values)
    }
    return out
  }, [rows])

  // Criteria that produce the same route share a letter, so it is obvious at a
  // glance when two cost functions were never going to disagree on this trip.
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

  /** A ranked cell: monospace, right-aligned, marked when it wins its column. */
  const cell = (row: Row, column: Ranked, text: (v: number) => string) => {
    const value = row[column]
    return (
      <td className="r num" key={column} data-best={best[column] === value}>
        {text(value)}
      </td>
    )
  }

  return (
    <section className="compare">
      <button className="compare-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="compare-title">Compare cost functions</span>
        <span className="compare-sub">
          {algoOf(algo).name} · {vehicleOf(vehicle).name.toLowerCase()} · {periodOf(period).name.toLowerCase()}
        </span>
        <span className="compare-caret">{open ? 'Collapse' : 'Expand'}</span>
      </button>

      {open && unsupported && (
        <div className="compare-body">
          <p className="note warn">
            Held–Karp runs only on the Python backend, and none is configured, so this table
            cannot plan for it. Set <code>VITE_API_URL</code>, or switch the first pane to
            another algorithm.
          </p>
        </div>
      )}

      {open && error && <div className="compare-body"><p className="note warn">{error}</p></div>}

      {open && !unsupported && !error && !rows && (
        <div className="compare-body">
          <p className="note">Planning the same trip under each cost function…</p>
        </div>
      )}

      {open && rows && (
        // The previous numbers stay on screen and fade while a fresh run is in
        // flight, rather than blanking on every slider nudge.
        <div className="compare-body" data-stale={busy}>
          <table className="compare-table criteria">
            <thead>
              <tr>
                <th>Cost function</th>
                <th title="Distance · time · congestion · risk">Weights</th>
                <th className="r">Distance</th>
                <th className="r">Time</th>
                <th className="r" title="Congestion level summed along the route, weighted by segment length">Congestion</th>
                <th className="r" title="Risk factor summed along the route, weighted by segment length">Risk</th>
                <th className="r" title="Total cost under this row's own weights. Not comparable between rows">Own cost</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} data-on={row.key === criterion}>
                  <th scope="row">
                    <button
                      className="compare-pick"
                      onClick={() => setCriterion(row.key)}
                      disabled={row.key === 'custom'}
                      title={row.key === 'custom'
                        ? 'These are the weights currently set on the sliders'
                        : `Switch the whole app to ${row.name}`}
                    >
                      {row.name}
                    </button>
                  </th>
                  <td className="num weights-cell">
                    {row.weights.distance.toFixed(1)} · {row.weights.time.toFixed(1)} ·{' '}
                    {row.weights.congestion.toFixed(1)} · {row.weights.risk.toFixed(1)}
                  </td>
                  {row.result.found ? (
                    <>
                      {cell(row, 'km', v => `${v.toFixed(2)} km`)}
                      {cell(row, 'minutes', v => `${v} min`)}
                      {cell(row, 'congestion', v => v.toFixed(1))}
                      {cell(row, 'risk', v => v.toFixed(2))}
                      <td className="r num">{row.result.metrics.cost.toFixed(1)}</td>
                      <td><span className="compare-group">{groupOf(row.result.path)}</span></td>
                    </>
                  ) : (
                    <td className="fail" colSpan={6}>{row.result.problem ?? 'no route'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 9 }}>
            Same trip, same vehicle, same hour, same algorithm — only the cost function changes.
            The four ranked columns are measured the same way for every row, so the best value in
            each is marked; <b>Own cost</b> is each row scored by its own weights and is
            <b> not</b> comparable down the column. Same letter under <b>Route</b> means two cost
            functions chose the same road. Click a name to switch the whole app to it.
          </p>
        </div>
      )}
    </section>
  )
}
