import type { Place } from './types'

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
