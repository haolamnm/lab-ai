/**
 * Every graph this app can build must satisfy the bounds the backend enforces.
 *
 * The backend validates `km > 0`, `1 <= congestion <= 5` and `0 <= risk <= 1` at
 * the wire, and answers 422 for anything outside them. The frontend is the only
 * producer of those numbers, and it keeps them in range by its own means — a
 * short-edge skip in `overpass.ts`, `clampCongestion`/`clampRisk` in
 * `traffic.ts`, hand-written literals in `sampleGraph.ts`.
 *
 * Nothing ties the two together. Widen a clamp, or relax a `Field(...)` bound
 * and forget its clamp, and the pair drifts silently until a user builds a real
 * area and every plan comes back 422 — the app dead in the water for a reason
 * visible in neither file alone. These tests are that tie: they assert the
 * producer's output against the consumer's rules, restated here as constants so
 * a change on either side has to be made deliberately on both.
 */

import { expect, test } from 'bun:test'
import { buildSampleGraph } from './sampleGraph'
import { clampCongestion, clampRisk } from './traffic'
import type { Graph } from './types'

/** The bounds `server/src/route_lab/contract/graph.py` rejects outside of. */
const BOUNDS = {
  km: { min: 0, max: Infinity, exclusiveMin: true },
  congestion: { min: 1, max: 5 },
  risk: { min: 0, max: 1 },
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
}

function expectWithinBounds(graph: Graph, label: string) {
  expect(graph.edges.length).toBeGreaterThan(0)
  for (const edge of graph.edges) {
    expect(Number.isFinite(edge.km), `${label}: km finite`).toBe(true)
    expect(edge.km, `${label}: km > 0`).toBeGreaterThan(BOUNDS.km.min)
    expect(edge.congestion, `${label}: congestion`).toBeGreaterThanOrEqual(BOUNDS.congestion.min)
    expect(edge.congestion, `${label}: congestion`).toBeLessThanOrEqual(BOUNDS.congestion.max)
    expect(edge.risk, `${label}: risk`).toBeGreaterThanOrEqual(BOUNDS.risk.min)
    expect(edge.risk, `${label}: risk`).toBeLessThanOrEqual(BOUNDS.risk.max)
  }
  for (const node of Object.values(graph.nodes)) {
    expect(node.lat, `${label}: lat`).toBeGreaterThanOrEqual(BOUNDS.lat.min)
    expect(node.lat, `${label}: lat`).toBeLessThanOrEqual(BOUNDS.lat.max)
    expect(node.lng, `${label}: lng`).toBeGreaterThanOrEqual(BOUNDS.lng.min)
    expect(node.lng, `${label}: lng`).toBeLessThanOrEqual(BOUNDS.lng.max)
  }
}

test('the sample graph is accepted by the backend contract', () => {
  // The sample graph is sent to the backend like any other, so its hand-written
  // edge table has to obey the same rules an Overpass import does.
  expectWithinBounds(buildSampleGraph(), 'sample')
})

test('the congestion clamp matches the backend bound exactly', () => {
  // Not "is within" but "is exactly": a clamp narrower than the bound would
  // quietly make part of the contract unreachable, and a wider one would 422.
  expect(clampCongestion(-99)).toBe(BOUNDS.congestion.min)
  expect(clampCongestion(99)).toBe(BOUNDS.congestion.max)
  expect(clampCongestion(3)).toBe(3)
})

test('the risk clamp matches the backend bound exactly', () => {
  expect(clampRisk(-99)).toBe(BOUNDS.risk.min)
  expect(clampRisk(99)).toBe(BOUNDS.risk.max)
  expect(clampRisk(0.5)).toBe(0.5)
})
