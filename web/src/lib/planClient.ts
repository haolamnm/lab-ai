import type { PlanInput } from './search'
import type { Graph, GraphEdge, RouteResult } from './types'

/**
 * Base URL of the backend, with any trailing slash already stripped so a
 * configured `http://host:8000/` cannot produce a `//plan` request path.
 *
 * Computed once, and empty when nothing is configured. That is what makes the
 * guard below structural: the URL and the flag saying whether there is one can
 * no longer disagree, which is how `String(undefined)` used to reach `fetch` as
 * the literal path `undefined/plan`.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Whether a planning backend is configured. Unset means plan in the browser. */
export const backendEnabled = !!API_BASE

/** An edge as the backend receives it — see `planRouteRemote` for why the polyline goes. */
type RemoteEdge = Omit<GraphEdge, 'shape'>

/** The subset of `Graph` the backend accepts: it rebuilds `adj` from `edges` itself. */
type RemoteGraph = Omit<Graph, 'adj' | 'edges'> & { edges: RemoteEdge[] }

interface PlanRequest {
  graph: RemoteGraph
  algo: PlanInput['algo']
  start: PlanInput['start']
  goal: PlanInput['goal']
  stops: PlanInput['stops']
  optimiseOrder: PlanInput['optimiseOrder']
  /** Omitted entirely when nothing sets it, which is the backend's legacy
   *  `goal`-based branch — the flag is tri-state there, not a boolean. */
  returnToStart?: PlanInput['returnToStart']
  conditions: PlanInput['conditions']
}

/** Narrows a parsed-JSON value far enough to read named fields off it. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The message of a caught value, whatever was actually thrown.
 *
 * A `catch` binding is `unknown` under `strict`, and the tempting `(e as Error).message`
 * is a lie: throwing a string — which `fetch`, Leaflet, and any hand-written
 * `throw '…'` all can — puts the literal text `undefined` in front of the user
 * where the reason should be.
 */
export function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : String(e)
}

/** The metric fields every renderer reads unconditionally (MapPane, Compare, Explain).
 *  The optional ones (hops/generated/reopened/maxFrontier) are not required here. */
const REQUIRED_METRICS = ['km', 'minutes', 'cost', 'expanded', 'ms', 'turnsBlocked'] as const

/** Checks the shape the app reads, including the metric fields the renderers touch
 *  without guarding. This is the boundary against version skew between the app and the
 *  server: a missing field must surface here as a clean run error, not as a `TypeError`
 *  thrown deep inside a render pass. It does not re-check trace/reveal element shapes,
 *  which are trusted the same way a local `planRoute` result is once it leaves search.ts. */
function isRouteResult(value: unknown): value is RouteResult {
  if (!isRecord(value)) return false
  if (!isRecord(value.metrics)) return false
  const m = value.metrics
  return typeof value.algo === 'string'
    && typeof value.found === 'boolean'
    && Array.isArray(value.trace)
    && Array.isArray(value.path)
    && Array.isArray(value.order)
    && Array.isArray(value.nodeIds)
    && Array.isArray(value.reveal)
    && typeof m.optimal === 'boolean'
    && REQUIRED_METRICS.every(k => typeof m[k] === 'number')
}

/**
 * Calls the Python backend for one leg-planning request.
 *
 * The payload omits two things the planner never reads. `graph.adj` is a derived
 * index the backend rebuilds from `edges` on its own, and every edge in it is the
 * same object already present in `edges`. `edge.shape` is the full OpenStreetMap
 * polyline, which exists so the browser can draw the road in its true shape and
 * is by far the largest field in the request — a Run posts the whole road network
 * once per pane, so carrying a drawing instruction six times to a server that
 * never looks at it is the single biggest waste on this seam.
 */
export async function planRouteRemote(input: PlanInput): Promise<RouteResult> {
  const { graph, ...rest } = input
  const { adj: _adj, edges, ...graphRest } = graph
  const body: PlanRequest = {
    ...rest,
    graph: { ...graphRest, edges: edges.map(({ shape: _shape, ...edge }) => edge) },
  }

  const response = await fetch(`${API_BASE}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // Include the body. Every field on this seam is enforced by Pydantic, so a 422
  // names the exact field that drifted — and discarding it left the one message
  // that could explain a version skew reading only "Backend returned 422".
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}: ${await response.text()}`)
  }

  const parsed: unknown = await response.json()
  if (!isRouteResult(parsed)) {
    throw new Error('Backend response is not a valid RouteResult')
  }
  return parsed
}
