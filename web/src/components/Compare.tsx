import { useMemo, useState } from 'react'
import { Icon, VEHICLE_ICON } from '../icons'
import { algoOf, planRoute } from '../lib/search'
import { banReason, periodOf, VEHICLES } from '../lib/traffic'
import { anchorTo, useStore } from '../store'

/** Route groups are named with letters, so it's obvious at a glance which vehicles share a route. */
const GROUP = ['A', 'B', 'C', 'D']

/**
 * Comparison table across the four vehicle types.
 *
 * The pane grid compares **algorithms**: one pane per algorithm, same trip.
 * Vehicle type is the opposite — it's a setting shared by the whole grid, so
 * previously, seeing where a truck's route diverges from a motorbike's meant
 * switching vehicles and remembering the old numbers by hand. This table runs
 * all four vehicles at once, holding the algorithm, time period, and weights fixed.
 *
 * It's not just "switch vehicle and rerun four times" because each vehicle
 * type **snaps to a different intersection**: a spot a motorbike can leave
 * from might not be reachable by truck. The table has to re-snap separately
 * for each vehicle, or it would be comparing two different things.
 *
 * Only computed when the user opens it, since each computation is four full
 * searches — running it in the background on every weight-slider nudge would
 * make the whole UI stutter.
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
      // Pin through the shared rule, not a local copy of it. Each vehicle needs
      // its own pin — a truck cannot start where a motorbike can — and getting
      // that rule subtly different here than in the sidebar would make this
      // table disagree with the panes it is meant to be compared against.
      const from = anchorTo(graph, start.place, v.key, period)
      const to = anchorTo(graph, goal.place, v.key, period)
      const result = planRoute({
        graph, algo,
        start: from.nodeId, goal: to.nodeId,
        stops: stops.map(x => anchorTo(graph, x.place, v.key, period).nodeId),
        optimiseOrder,
        conditions: { vehicle: v.key, period, weights },
      })
      // Count blocked edges to see how constrained this vehicle type is, and why.
      // Collect every reason instead of just the first: an all-day ban is always
      // encountered first, so taking only the first reason would mean truck curfews never get mentioned.
      let blocked = 0
      const why = new Set<string>()
      for (const e of graph.edges) {
        const r = banReason(e, v.key, period)
        if (r) { blocked++; why.add(r) }
      }
      return { v, result, blocked, reason: [...why].join('. '), snapped: Math.max(from.metres, to.metres) }
    })
  }, [open, graph, algo, period, weights, start, goal, stops, optimiseOrder])

  // Vehicles that share a route get the same letter.
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
        <span className="compare-title">Compare vehicles</span>
        <span className="compare-sub">
          {algoOf(algo).name} · {periodOf(period).name.toLowerCase()}
        </span>
        <span className="compare-caret" data-open={open}>{open ? 'Collapse' : 'Expand'}</span>
      </button>

      {open && rows && (
        <div className="compare-body">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th className="r">Distance</th>
                <th className="r">Time</th>
                <th className="r">Cost</th>
                <th className="r">Blocked edges</th>
                <th className="r">Turn restrictions</th>
                <th className="r">Farthest snap</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, result, blocked, reason, snapped }) => {
                const m = result.metrics
                return (
                  <tr key={v.key} data-on={v.key === vehicle}>
                    <th scope="row">
                      <button className="compare-pick" onClick={() => setVehicle(v.key)} title={`Switch to ${v.name}`}>
                        <Icon name={VEHICLE_ICON[v.key]} size={17} solid={v.key === vehicle} />
                        {v.name}
                      </button>
                    </th>
                    {result.found ? (
                      <>
                        <td className="r num">{m.km.toFixed(2)} km</td>
                        <td className="r num">{m.minutes} min</td>
                        <td className="r num">{m.cost.toFixed(1)}</td>
                        <td className="r num" title={reason || 'No road-class restrictions apply'}>
                          {blocked ? `${blocked}/${graph.edges.length}` : '—'}
                        </td>
                        <td className="r num">{m.turnsBlocked || '—'}</td>
                        <td className="r num">{snapped} m</td>
                        <td><span className="compare-group">{groupOf(result.path)}</span></td>
                      </>
                    ) : (
                      <td className="fail" colSpan={7}>{result.problem ?? 'unreachable'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 9 }}>
            Same letter in the <b>Route</b> column means the same road. The <b>Blocked edges</b> column
            includes truck curfews, so changing the time period changes the number too. Click a vehicle name to switch the whole grid to it.
          </p>
        </div>
      )}
    </section>
  )
}
