import { useMemo, useState } from 'react'
import { algoOf } from '../lib/search'
import { tripNames } from '../lib/tripNames'
import type { Metrics } from '../lib/types'
import { useStore } from '../store'

/** Columns where the smallest number wins, so the best one can be marked. */
const LOWER_IS_BETTER = ['cost', 'km', 'minutes', 'hops', 'expanded', 'ms'] as const
type Ranked = (typeof LOWER_IS_BETTER)[number]

/**
 * The algorithm comparison table.
 *
 * The pane grid already runs every algorithm on one trip, but a pane shows its
 * numbers in a footer beside its own map, so comparing six of them means reading
 * six corners of the screen and holding the numbers in your head. This is the
 * same runs in one column-aligned table.
 *
 * It costs nothing to compute: it reads the results the panes are already
 * holding. Planning again here would be six more requests carrying the whole
 * road network, and worse, it could disagree with the panes above it — a second
 * run under settings the user changed in between would put two different answers
 * for one algorithm on one screen.
 *
 * Four of these columns are numbers the backend has always measured and the app
 * has always thrown away. `generated`, `reopened` and the frontier peak are what
 * separate algorithms that expand a similar number of nodes: UCS and A* can
 * finish within a few expansions of each other while A* generated half as many
 * states and never had to reopen one. Without them "expanded" is the only
 * measure of work, and it flatters whichever algorithm got lucky.
 */
export function CompareAlgos() {
  const panes = useStore(s => s.panes)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const step = useStore(s => s.step)
  const [open, setOpen] = useState(true)

  const nameOf = useMemo(() => tripNames(start, goal, stops), [start, goal, stops])

  const rows = useMemo(
    () => panes.flatMap(p => (p.result ? [{ key: p.id, algo: p.algo, result: p.result }] : [])),
    [panes],
  )

  /**
   * The positions in the visit order where the algorithms do not all agree.
   *
   * Six rows of identical place names are hard to read a difference out of —
   * the eye has to compare them word by word, and the whole point of the column
   * is the one stop somebody swapped. Marking the positions where the rows
   * disagree puts the difference where it can be seen.
   *
   * No row is treated as the reference. Picking one — the first, or the optimal
   * one — would say the others are wrong, and on a trip where two orders cost
   * exactly the same that is not true. What this marks is disagreement, which is
   * symmetric: if the rows differ at a position, it is marked in every row.
   */
  const disagrees = useMemo(() => {
    const orders = rows.filter(r => r.result.found).map(r => r.result.order)
    const out = new Set<number>()
    if (orders.length < 2) return out
    const longest = Math.max(...orders.map(o => o.length))
    for (let i = 0; i < longest; i++) {
      // A row that has already ended counts as differing: a shorter tour visits
      // a different set of places, which is exactly a disagreement.
      const first = orders[0][i]
      if (orders.some(o => o[i] !== first)) out.add(i)
    }
    return out
  }, [rows])

  // The winning value in each ranked column, over the runs that found a route.
  // A column every row leaves blank has no winner, which is why this can be
  // undefined rather than defaulting to zero — marking "0 ms" as the best time
  // when no row reported a time would be inventing a result.
  const best = useMemo(() => {
    const out: Partial<Record<Ranked, number>> = {}
    const found = rows.filter(r => r.result.found)
    for (const column of LOWER_IS_BETTER) {
      const values = found
        .map(r => r.result.metrics[column])
        .filter((v): v is number => typeof v === 'number')
      if (values.length > 1) out[column] = Math.min(...values)
    }
    return out
  }, [rows])

  if (!rows.length) return null

  /** A metric cell: monospace, right-aligned, marked when it is the best in its column. */
  const cell = (m: Metrics, column: Ranked, text: (v: number) => string) => {
    const value = m[column]
    if (typeof value !== 'number') return <td className="r num" key={column}>—</td>
    return (
      <td className="r num" key={column} data-best={best[column] === value}>
        {text(value)}
      </td>
    )
  }

  // Only worth a column when some algorithm actually had an ordering decision to
  // make. Pickup then dropoff is not an order any algorithm chose.
  const showOrder = rows.some(r => r.result.order.length > 2)

  return (
    <section className="compare">
      <button className="compare-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="compare-title">Compare algorithms</span>
        <span className="compare-sub">
          {rows.length} {rows.length === 1 ? 'run' : 'runs'} · same trip, same cost function
        </span>
        <span className="compare-caret">{open ? 'Collapse' : 'Expand'}</span>
      </button>

      {open && (
        <div className="compare-body">
          <table className="compare-table algos">
            <thead>
              <tr>
                <th>Algorithm</th>
                {showOrder && <th>Visit order</th>}
                <th className="r" title="Total cost under the current cost function">Cost</th>
                <th className="r">Distance</th>
                <th className="r">Time</th>
                <th className="r" title="Road segments in the chosen route">Hops</th>
                <th className="r" title="Nodes taken off the frontier and expanded">Expanded</th>
                <th className="r" title="States pushed onto the frontier. Backend only">Generated</th>
                <th className="r" title="States reached again by a cheaper route. Backend only">Reopened</th>
                <th className="r" title="Largest the frontier ever grew. Backend only">Peak frontier</th>
                <th className="r">Runtime</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, algo, result }) => {
                const info = algoOf(algo)
                const m = result.metrics
                const done = step >= result.trace.length
                return (
                  <tr key={key}>
                    <th scope="row">
                      <span className="algo-name">
                        <i className="algo-swatch" style={{ background: info.hue }} />
                        {info.name}
                      </span>
                    </th>
                    {result.found ? (
                      <>
                        {showOrder && (
                          <td className="compare-order">
                            {result.order.length > 2
                              ? result.order.map((id, i) => (
                                <span key={`${id}-${i}`}>
                                  {i > 0 && ' → '}
                                  <span data-differs={disagrees.has(i)}>{nameOf(id)}</span>
                                </span>
                              ))
                              : '—'}
                          </td>
                        )}
                        {cell(m, 'cost', v => v.toFixed(1))}
                        {cell(m, 'km', v => `${v.toFixed(2)} km`)}
                        {cell(m, 'minutes', v => `${v} min`)}
                        {cell(m, 'hops', v => String(v))}
                        {cell(m, 'expanded', v => String(v))}
                        <td className="r num">{m.generated ?? '—'}</td>
                        <td className="r num">{m.reopened ?? '—'}</td>
                        <td className="r num">{m.maxFrontier ?? '—'}</td>
                        {cell(m, 'ms', v => `${v.toFixed(1)} ms`)}
                        <td className="verdict-cell" data-optimal={m.optimal}>
                          {/* Held back until the run has played out, exactly as the pane
                              footer holds back the distance: the verdict is the answer. */}
                          {!done ? 'running' : m.optimal ? 'optimal' : 'approximate'}
                        </td>
                      </>
                    ) : (
                      <td className="fail" colSpan={showOrder ? 11 : 10}>
                        {result.problem ?? 'no route'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 9 }}>
            Every row is the same trip under the same cost function, so the columns are
            directly comparable; the best value in each is marked. In <b>Visit order</b>,
            a stop is <span className="order-differs">red</span> where the algorithms did
            not all choose the same place at that point in the tour.{' '}<b>Generated</b>,{' '}
            <b>Reopened</b> and <b>Peak frontier</b> are measured by the Python backend only —
            they read “—” when the app is planning in the browser.
          </p>
        </div>
      )}
    </section>
  )
}
