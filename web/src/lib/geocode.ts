import type { Place } from './types'

/**
 * Tra toạ độ từ tên địa điểm. Dùng Nominatim của OpenStreetMap vì không cần
 * khoá. Bản nộp nên đổi sang Goong — gợi ý địa chỉ tiếng Việt tốt hơn hẳn —
 * chỉ cần thay thân hàm này, phần còn lại của ứng dụng không đổi.
 */
export async function findPlaces(text: string, signal?: AbortSignal): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=vn' +
    '&accept-language=vi&q=' + encodeURIComponent(text)
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Không tra được địa điểm')
  const rows: { display_name: string; name?: string; lat: string; lon: string }[] = await res.json()
  return rows.map(r => {
    const parts = r.display_name.split(',').map(s => s.trim())
    return {
      name: r.name || parts[0],
      detail: parts.slice(1, 4).join(', '),
      lat: +r.lat,
      lng: +r.lon,
    }
  })
}
