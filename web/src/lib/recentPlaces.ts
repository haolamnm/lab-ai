import type { Place } from './types'

/**
 * The places picked recently, kept between sessions.
 *
 * Every trip in this app starts by typing a place name and waiting on a
 * geocoder, and the places worth comparing routes between are the same handful
 * over and over — the warehouse, the two markets, the one address that snaps
 * badly. Retyping them is the slowest part of using the thing, and the second
 * lookup returns exactly what the first one did.
 *
 * Stored rather than held in memory because the reason to want it back is
 * usually that the page was reloaded.
 */

const KEY = 'route-lab:recent-places'
/** Enough to cover a session's worth of trips without becoming a list to search. */
const KEEP = 8

/** Same spot picked twice: coordinates match to about a metre. */
function samePlace(a: Place, b: Place): boolean {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number'
}

/**
 * The stored list, newest first.
 *
 * Everything here came out of `localStorage`, which any extension or an older
 * build of this app could have written, so each entry is checked rather than
 * trusted: one malformed record would otherwise reach the map as a place with
 * no coordinates and take a pane down with it.
 */
export function recentPlaces(): Place[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(isPlace).slice(0, KEEP) : []
  } catch {
    return []
  }
}

/** Record a pick, moving it to the front if it was already there. */
export function rememberPlace(place: Place): void {
  try {
    const next = [place, ...recentPlaces().filter(p => !samePlace(p, place))].slice(0, KEEP)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // A full or blocked storage quota is not a reason to fail a place pick.
  }
}

export function forgetPlaces(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // As above: nothing here is worth interrupting the user over.
  }
}
