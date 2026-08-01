export interface LatLng { lat: number; lng: number }

const R = 6371 // bán kính Trái Đất, km

/** Khoảng cách đường chim bay giữa hai điểm, tính bằng km. */
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
 * Khung bao quanh các điểm, nới rộng thêm để thuật toán còn chỗ vòng tránh.
 * Nếu bó sát hai điểm thì mọi tuyến đều bị ép thành đường thẳng.
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

/** Số nguyên giả ngẫu nhiên nhưng ổn định theo chuỗi đầu vào. */
export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
