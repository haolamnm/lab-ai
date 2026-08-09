import { backendEnabled } from '../lib/planClient'
import { ALGOS, backendOnlyNote } from '../lib/search'
import { useStore } from '../store'

/**
 * The trip limits that apply only when a pane is running Held–Karp.
 *
 * Held–Karp is the one algorithm in the grid with a stop ceiling, and it cannot
 * run at all without the Python backend. Both conditions are checked again on
 * the server, which is what makes it safe to only warn here: nothing about this
 * component is load-bearing for correctness, and the Run button stays enabled
 * so the other panes — which have no such limits — still run.
 *
 * It renders nothing unless a pane actually asks for Held–Karp, so a trip that
 * never touches the algorithm never sees a rule about it.
 */
export function HeldKarpNotice() {
  // One selector per field, like the panes do: this sits inside the sidebar,
  // which deliberately avoids subscribing to state it does not read.
  const panes = useStore(s => s.panes)
  const stops = useStore(s => s.stops)

  if (!panes.some(p => p.algo === 'held_karp')) return null

  const maxStops = ALGOS.held_karp.maxStops

  return (
    <>
      {maxStops !== undefined && stops.length > maxStops && (
        <p className="note warn">
          Held–Karp supports up to <span className="num">{maxStops}</span> stops;
          this trip has <span className="num">{stops.length}</span>.
        </p>
      )}

      {!backendEnabled && <p className="note warn">{backendOnlyNote('held_karp')}</p>}
    </>
  )
}
