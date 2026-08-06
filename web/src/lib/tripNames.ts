import type { Graph, Place } from './types'

/** The three kinds of trip point, as the store holds them. */
interface Pinned {
  place: Place
  nodeId: string | null
}

/**
 * Builds the lookup from a node id back to the place the user picked there.
 *
 * A node id is a coordinate string that means nothing to a reader, so anything
 * printing a visit order has to translate it back to "Chợ Bến Thành" first. The
 * explanation block owned this table privately until the panes needed to print
 * their own order too; a second copy would drift the moment one of them started
 * naming an unpinned intersection differently from the other, and the two would
 * then disagree about the same route on the same screen.
 *
 * Ids that were never pinned — every intersection the route passes through
 * between stops — are not trip points and have no name to give.
 */
export function tripNames(
  start: Pinned | null, goal: Pinned | null, stops: Pinned[],
): (nodeId: string) => string {
  const table = new Map<string, string>()
  if (start?.nodeId) table.set(start.nodeId, start.place.name)
  if (goal?.nodeId) table.set(goal.nodeId, goal.place.name)
  for (const stop of stops) if (stop.nodeId) table.set(stop.nodeId, stop.place.name)
  return nodeId => table.get(nodeId) ?? 'intersection'
}

/** How many street names an intersection is described by before it stops helping. */
const STREETS_SHOWN = 2

/**
 * Names any intersection in the network, not only the ones the user pinned.
 *
 * A node id is a coordinate string, so a search tree built from OpenStreetMap
 * data had nothing to call its nodes but the order they came off the frontier —
 * "#124" says when a node was expanded and nothing whatever about where it is.
 * The sample graph got letters because it was authored with them; a real
 * extract has none, and inventing A, B, C… would only be a second arbitrary
 * numbering wearing letters.
 *
 * The names are already in the data, on the edges: OpenStreetMap labels ways,
 * not junctions. So an intersection is named by the streets that meet there,
 * which is how anybody in a city gives a location anyway. Three or more streets
 * meet at plenty of junctions, but past two the name is longer than the thing
 * it identifies, so the rest are dropped.
 *
 * A pinned trip point keeps the name the user chose — "Chợ Bến Thành" beats any
 * pair of street names, and it is what every other part of the interface calls
 * that node.
 */
export function nodeNames(
  graph: Graph, start: Pinned | null, goal: Pinned | null, stops: Pinned[],
): (nodeId: string) => string | undefined {
  const pinned = tripNames(start, goal, stops)
  const cache = new Map<string, string | undefined>()

  return nodeId => {
    if (cache.has(nodeId)) return cache.get(nodeId)

    const trip = pinned(nodeId)
    let name: string | undefined = trip === 'intersection' ? undefined : trip
    // The sample graph authors both, and its own place name is the better one.
    name ??= graph.nodes[nodeId]?.name

    if (!name) {
      const streets: string[] = []
      for (const edge of graph.adj[nodeId] ?? []) {
        if (edge.name && !streets.includes(edge.name)) streets.push(edge.name)
        if (streets.length === STREETS_SHOWN) break
      }
      // "×" rather than "&": these are two streets crossing, not two things listed.
      if (streets.length) name = streets.join(' × ')
    }

    cache.set(nodeId, name)
    return name
  }
}
