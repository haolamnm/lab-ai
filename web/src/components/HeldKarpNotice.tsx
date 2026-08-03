import { backendEnabled } from '../lib/planClient'
import { useStore } from '../store'

/**
 * Matches `MAX_HELD_KARP_STOPS` in `server/src/route_lab/planner.py`.
 *
 * The DP is O(n² · 2ⁿ) in the number of stops, so this is a ceiling the
 * algorithm imposes rather than a policy the UI is free to raise. It is stated
 * here only so the user hears about it before pressing Run — the backend is
 * still the one that enforces it.
 */
const MAX_HELD_KARP_STOPS = 12

/**
 * The trip rules that apply only when a pane is running Held–Karp.
 *
 * Held–Karp is the one algorithm in the grid that constrains the trip itself:
 * it plans a closed tour, so the dropoff has to be the pickup warehouse, and it
 * cannot run at all without the Python backend. Every one of these conditions
 * is checked again on the server, which is what makes it safe to only warn
 * here: nothing about this component is load-bearing for correctness, and the
 * Run button stays enabled so the other panes — which have no such constraints
 * — still run.
 *
 * It renders nothing unless a pane actually asks for Held–Karp, so a trip that
 * never touches the algorithm never sees a rule about it.
 */
export function HeldKarpNotice() {
  // One selector per field, like the panes do: this sits inside the sidebar,
  // which deliberately avoids subscribing to state it does not read.
  const panes = useStore(s => s.panes)
  const start = useStore(s => s.start)
  const goal = useStore(s => s.goal)
  const stops = useStore(s => s.stops)
  const sample = useStore(s => s.sample)
  const setPlace = useStore(s => s.setPlace)

  if (!panes.some(p => p.algo === 'held_karp')) return null

  // Compare the pinned intersections, not the places: that is what the backend
  // compares, and two pins a few metres apart can still snap to one node.
  const openTour = !!start?.nodeId && !!goal?.nodeId && start.nodeId !== goal.nodeId

  return (
    <>
      <p className="note lift" style={{ marginTop: 10 }}>
        <strong>Held–Karp</strong> plans a closed tour: it always returns to the pickup
        warehouse, and it always chooses the cheapest visit order — whatever the
        setting above says.
      </p>

      {openTour && (
        <p className="note warn" style={{ marginTop: 8 }}>
          The dropoff is a different intersection from the pickup, so there is no closed
          tour to plan.{' '}
          <button className="link-button" onClick={() => setPlace('goal', start.place)}>
            Return to warehouse
          </button>
        </p>
      )}

      {stops.length > MAX_HELD_KARP_STOPS && (
        <p className="note warn" style={{ marginTop: 8 }}>
          Held–Karp supports up to <span className="num">{MAX_HELD_KARP_STOPS}</span> stops;
          this trip has <span className="num">{stops.length}</span>.
        </p>
      )}

      {sample ? (
        <p className="note warn" style={{ marginTop: 8 }}>
          Held–Karp runs only on the Python backend, and the sample graph never leaves the
          browser. Build an OpenStreetMap network to use it.
        </p>
      ) : !backendEnabled && (
        <p className="note warn" style={{ marginTop: 8 }}>
          Held–Karp runs only on the Python backend. Set <code>VITE_API_URL</code> and start
          the server, then reload.
        </p>
      )}
    </>
  )
}
