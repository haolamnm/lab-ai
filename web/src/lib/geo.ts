export interface LatLng { lat: number; lng: number }

const R = 6371 // Earth's radius, km

/** Straight-line distance between two points, in km. */
export function haversine(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function pathKm(points: [number, number][]): number {
  let km = 0
  for (let i = 0; i + 1 < points.length; i++)
    km += haversine({ lat: points[i][0], lng: points[i][1] }, { lat: points[i + 1][0], lng: points[i + 1][1] })
  return km
}

/**
 * Tight bounding box around the points, in the corner-pair form Leaflet takes.
 *
 * Every graph source ends up needing this — the OpenStreetMap build, the sample
 * graph, and an imported JSON file — and all three used to spell it out by hand.
 * Three copies of one expression is three places to fix the day the box needs a
 * margin or a different corner order.
 */
export function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng)
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
}

/**
 * Bounding box around the points, padded out so the algorithm has room to
 * route around obstacles. If the box hugs the points tightly, every route
 * gets forced into a straight line.
 */
export function paddedBounds(points: LatLng[], padRatio = 0.22, minPadKm = 0.8) {
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng)
  let s = Math.min(...lats), n = Math.max(...lats)
  let w = Math.min(...lngs), e = Math.max(...lngs)
  const latPadMin = minPadKm / 111
  const lngPadMin = minPadKm / (111 * Math.cos((((s + n) / 2) * Math.PI) / 180))
  const latPad = Math.max((n - s) * padRatio, latPadMin)
  const lngPad = Math.max((e - w) * padRatio, lngPadMin)
  return { south: s - latPad, north: n + latPad, west: w - lngPad, east: e + lngPad }
}

/** A pseudo-random number that stays stable for a given input string. */
export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
