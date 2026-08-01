import { useMemo } from 'react'
import { explain, toExportable } from '../lib/explain'
import { algoOf } from '../lib/search'
import type { Conditions } from '../lib/traffic'
import { useStore } from '../store'

/**
 * The route-explanation block.
 *
 * The brief calls out a dedicated section for this: the system isn't allowed
 * to just return a path — it has to say why that route was chosen, where it
 * loses to the alternatives, which segment is congested, and whether the
 * result is optimal.
 *
 * Every sentence here is built from the current run's numbers. Change the
 * time period or drag a weight slider and the explanation updates immediately.
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

  // Keyed on the results themselves, not on the panes array. Switching a pane's
  // view tab rebuilds that array without touching a single result, and keying on
  // it would re-run the whole explanation — a scan of every segment on the
  // winning route — for a click that cannot change a word of the output.
  //
  // This leans on an invariant worth stating: every setter that can change what
  // a route would be calls clearResults(), which nulls each result and puts an
  // 'x' in this key. Without that, two runs under different weights could land
  // on the same algorithm and the same node count and the key would not budge,
  // leaving a stale explanation next to a changed route. A new setter that skips
  // clearResults() breaks this.
  const resultKey = panes.map(p => `${p.algo}:${p.result ? p.result.trace.length : 'x'}`).join('|')
  const results = useMemo(
    () => panes.filter(p => p.result).map(p => ({ algo: algoOf(p.algo).name, result: p.result! })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultKey],
  )

  // Node IDs are coordinate strings that mean nothing to a reader — map them back to the chosen place names.
  const nameOf = useMemo(() => {
    const table = new Map<string, string>()
    if (start?.nodeId) table.set(start.nodeId, start.place.name)
    if (goal?.nodeId) table.set(goal.nodeId, goal.place.name)
    stops.forEach(s => { if (s.nodeId) table.set(s.nodeId, s.place.name) })
    return (id: string) => table.get(id) ?? 'intersection'
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
    a.download = 'route-lab-data.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="explain">
      <header className="explain-head">
        <h2>Why this route was chosen</h2>
        <button className="button" onClick={download} title="Save the network and results to a JSON file">
          Export data
        </button>
      </header>

      <div className="explain-body">
        <p className="explain-lead">
          {info.headline}
          {info.titles.length > 0 && <> Among the algorithms currently running, this is the {info.titles.join(', ')} route.</>}
        </p>

        {info.order && (
          <p className="explain-row"><b>Visit order</b> {info.order}</p>
        )}

        {info.jams.length > 0 && (
          <p className="explain-row">
            <b>Most congested segment on the route</b>{' '}
            {info.jams.map(j => (
              <span className="jam" key={j.name}>
                {j.name} · <span className="num">{j.km.toFixed(2)}</span> km ·
                congestion <span className="num">{j.congestion}</span>/5 ·
                costs <span className="num">{j.minutes.toFixed(1)}</span> min
              </span>
            ))}
          </p>
        )}

        {info.rivals.length > 0 && (
          <p className="explain-row">
            <b>Compared to other options</b>{' '}
            {info.rivals.map(r => (
              <span className="rival" key={r.algo}>{r.algo} {r.verdict}</span>
            ))}
          </p>
        )}

        <p className="explain-row"><b>Optimality</b> {info.optimality}</p>
      </div>
    </section>
  )
}
