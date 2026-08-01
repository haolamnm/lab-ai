import type { Place } from './types'

/**
 * Look up coordinates from a place name. Uses OpenStreetMap's Nominatim
 * because it needs no API key. The submission should switch to Goong —
 * its Vietnamese address suggestions are much better — just by swapping
 * this function's body; the rest of the app stays unchanged.
 */
export async function findPlaces(text: string, signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=vn' +
    '&accept-language=vi&q=' + encodeURIComponent(text)
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Could not look up the place')
  const rows: unknown = await res.json()
  // Nominatim returns status 200 with an {error: ...} object when the query
  // parameters are wrong, so the res.ok check above doesn't catch it. Without
  // a type check here, rows.map would throw a raw TypeError instead of the
  // clean error message the rest of this function is built to produce.
  if (!Array.isArray(rows)) throw new Error('Could not look up the place')

  const places: Place[] = []
  for (const r of rows as { display_name?: string; name?: string; lat?: string; lon?: string }[]) {
    const lat = Number(r.lat), lng = Number(r.lon)
    // A row missing coordinates that slips through here becomes a Place
    // carrying NaN, and NaN travels all the way to haversine, which then
    // reports "the two points are too far apart" — a completely wrong
    // diagnosis. Drop the broken row and keep the usable ones.
    if (!r.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const parts = r.display_name.split(',').map(s => s.trim())
    places.push({ name: r.name || parts[0], detail: parts.slice(1, 4).join(', '), lat, lng })
  }
  return places
}
