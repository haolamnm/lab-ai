/**
 * The shared map viewport, so panning one pane pans them all.
 *
 * This used to be two module-level variables inside MapPane — a registry of
 * Leaflet instances and a `broadcasting` flag — and it carried three faults that
 * are all really the same fault: nothing owned the *current* shared view, only
 * the act of changing it.
 *
 *   - Switching sync back on did nothing until you happened to drag a map, so
 *     panes that had drifted apart just sat there, still apart, under a button
 *     that claimed they were synced.
 *   - A pane added later fitted itself to the whole network and broadcast that,
 *     yanking every other pane out of wherever the user had zoomed in to look.
 *   - The re-entry guard was set and cleared around a loop with no `finally`, so
 *     one throw inside Leaflet's `setView` left it stuck on and killed syncing
 *     for the rest of the session.
 *
 * Holding the last view here fixes all three: a pane that joins late reads it
 * instead of imposing its own, and switching sync on can replay it.
 */

/** What every pane's map agrees on: where it is centred, and how far in. */
export interface MapView {
  lat: number
  lng: number
  zoom: number
}

type Apply = (view: MapView) => void

const members = new Map<string, Apply>()
let shared: MapView | null = null
let delivering = false

/** Register a pane's map. Returns the function that unregisters it. */
export function joinViewSync(id: string, apply: Apply): () => void {
  members.set(id, apply)
  return () => { members.delete(id) }
}

/** The view panes currently agree on, or null when none has been established. */
export function sharedView(): MapView | null {
  return shared
}

/**
 * Forget the shared view.
 *
 * Called when a new road network arrives: the old centre and zoom describe a
 * different part of the world, and a pane adopting them would open looking at
 * nothing.
 */
export function resetViewSync(): void {
  shared = null
}

/** Record `view` as the shared one and push it to every pane except `from`. */
export function broadcastView(from: string | null, view: MapView): void {
  shared = view
  // Applying a view makes Leaflet fire `move`, which calls straight back in
  // here. The guard drops those echoes; `finally` makes sure a throw inside
  // Leaflet cannot leave syncing switched off permanently.
  if (delivering) return
  delivering = true
  try {
    members.forEach((apply, id) => { if (id !== from) apply(view) })
  } finally {
    delivering = false
  }
}
