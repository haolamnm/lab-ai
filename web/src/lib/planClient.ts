import type { PlanInput } from './search'
import type { Graph, RouteResult } from './types'

/** Base URL of the backend, unset when the app should plan locally instead. */
export const backendEnabled = !!import.meta.env.VITE_API_URL

/** The subset of `Graph` the backend accepts: it rebuilds `adj` from `edges` itself. */
type RemoteGraph = Omit<Graph, 'adj'>

interface PlanRequest {
  graph: RemoteGraph
  algo: PlanInput['algo']
  start: PlanInput['start']
  goal: PlanInput['goal']
  stops: PlanInput['stops']
  optimiseOrder: PlanInput['optimiseOrder']
  conditions: PlanInput['conditions']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
 * The payload omits `graph.adj`: it is a derived index the backend rebuilds from `edges`
 * on its own, and every edge in it is the same object already present in `edges` — sending
 * it too would double the size of every request without adding information.
 */
export async function planRouteRemote(input: PlanInput): Promise<RouteResult> {
  const { graph, ...rest } = input
  const { adj: _adj, ...remoteGraph } = graph
  const body: PlanRequest = { ...rest, graph: remoteGraph }

  // Tolerate a trailing slash in the configured base URL (`http://host:8000/`),
  // which would otherwise produce a `//plan` request path.
  const base = String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')
  const response = await fetch(`${base}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} ${response.statusText}`)
  }

  const parsed: unknown = await response.json()
  if (!isRouteResult(parsed)) {
    throw new Error('Backend response is not a valid RouteResult')
  }
  return parsed
}
