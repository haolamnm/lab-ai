/**
 * The sample graph has to be geometrically possible, because A* believes it is.
 *
 * `haversine_heuristic` estimates the remaining cost as the straight-line
 * distance to the goal times the cheapest cost-per-km in the network. That is
 * admissible — it can never overestimate — only while every road is at least as
 * long as the straight line it spans. A graph fetched from Overpass satisfies
 * that by construction, because `km` is measured from the road's own polyline
 * (`km = pathKm(shape)` in overpass.ts). This graph is hand-authored: `NODES`
 * carries real coordinates and `EDGES` carries lengths typed beside them, and
 * nothing tied the two together, so eight roads claimed to be shorter than the
 * straight line between their own endpoints.
 *
 * The consequence is not cosmetic. With distance-only weights the scale is
 * exactly 1.0, the heuristic becomes raw straight-line kilometres with no slack
 * left to absorb the discrepancy, and A* stops being optimal while still being
 * labelled so — with Held-Karp inheriting it through the Pairwise A* matrix it
 * orders from.
 */

import { expect, test } from 'bun:test'
import { buildSampleGraph } from './sampleGraph'
import { pathKm } from './geo'
import { planRoute } from './search'
import { CRITERIA } from './traffic'

const graph = buildSampleGraph()

test('no road is shorter than the shape it draws', () => {
  // The invariant A*'s admissibility rests on, stated where it can be checked.
  // Equality is allowed: a road that runs dead straight is exactly its own
  // straight line, which is what every edge here draws.
  const impossible = graph.edges
    .map(edge => ({ name: edge.name, km: edge.km, drawn: pathKm(edge.shape) }))
    .filter(edge => edge.km < edge.drawn - 1e-9)
    .map(edge => `${edge.name}: km=${edge.km} but draws ${edge.drawn.toFixed(3)} km`)

  expect(impossible).toEqual([])
})

test('A* agrees with UCS on cost, on every trip and every criterion', () => {
  // What the README promises: "A* — Same route as UCS, far fewer nodes
  // expanded". Both are exact, so any disagreement means the heuristic
  // overestimated somewhere and A* settled for a route UCS could beat.
  //
  // Every pair, because the eight bad roads were confined to one corner of the
  // network and the eight curated sample cases all missed them. Every criterion,
  // because only the distance-only one exposes it: the others scale the estimate
  // by roughly 4.0, and the discrepancy hides inside that margin.
  const ids = Object.keys(graph.nodes)
  const disagreements: string[] = []

  for (const [name, criterion] of Object.entries(CRITERIA)) {
    const conditions = {
      vehicle: 'bike' as const, period: 'peak' as const, weights: criterion.weights,
    }
    for (const start of ids) {
      for (const goal of ids) {
        if (start === goal) continue
        const input = {
          graph, start, goal, stops: [], optimiseOrder: false, returnToStart: false, conditions,
        }
        const ucs = planRoute({ ...input, algo: 'ucs' })
        const astar = planRoute({ ...input, algo: 'astar' })
        if (!ucs.found || !astar.found) continue
        if (astar.metrics.cost !== ucs.metrics.cost) {
          disagreements.push(
            `${name} ${start}->${goal}: ucs ${ucs.metrics.cost} via ${ucs.order.join('')}`
            + ` but astar ${astar.metrics.cost} via ${astar.order.join('')}`,
          )
        }
      }
    }
  }

  expect(disagreements).toEqual([])
})

test('an algorithm claiming optimal is never beaten by one that does not', () => {
  // The OPTIMAL badge is a static per-algorithm claim, not something measured per
  // run, so nothing catches it lying. This does: an exact algorithm losing to an
  // approximate one on the same trip means the guarantee is not being kept.
  const ids = Object.keys(graph.nodes)
  const beaten: string[] = []

  for (const [name, criterion] of Object.entries(CRITERIA)) {
    const conditions = {
      vehicle: 'bike' as const, period: 'peak' as const, weights: criterion.weights,
    }
    for (const start of ids) {
      for (const goal of ids) {
        if (start === goal) continue
        const input = {
          graph, start, goal, stops: [], optimiseOrder: false, returnToStart: false, conditions,
        }
        const claimed = planRoute({ ...input, algo: 'astar' })
        if (!claimed.found || !claimed.metrics.optimal) continue
        for (const algo of ['ucs', 'bfs', 'dfs', 'nearest'] as const) {
          const rival = planRoute({ ...input, algo })
          if (rival.found && rival.metrics.cost < claimed.metrics.cost) {
            beaten.push(
              `${name} ${start}->${goal}: astar claims optimal at ${claimed.metrics.cost}`
              + ` but ${algo} found ${rival.metrics.cost}`,
            )
          }
        }
      }
    }
  }

  expect(beaten).toEqual([])
})
