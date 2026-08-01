import { useEffect, useRef, useState } from 'react'
import { findPlaces } from '../lib/geocode'
import type { Place } from '../lib/types'

interface Props {
  role: string
  placeholder: string
  value?: { place: Place; nodeId: string | null; metres: number } | null
  autoFocus?: boolean
  onPick: (place: Place) => void
  onClear?: () => void
}

export function PlaceField({ role, placeholder, value, autoFocus, onPick, onClear }: Props) {
  const [text, setText] = useState(value?.place.name ?? '')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => setText(value?.place.name ?? ''), [value?.place.name])

  // Đóng danh sách khi bấm ra ngoài.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setResults(null)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  // Chờ người dùng ngừng gõ rồi mới hỏi, và huỷ lượt hỏi cũ khi có lượt mới.
  useEffect(() => {
    const q = text.trim()
    if (q.length < 3 || q === value?.place.name) { setResults(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setBusy(true); setFailed(false)
      try {
        setResults(await findPlaces(q, ctrl.signal))
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setResults([]); setFailed(true) }
      } finally {
        setBusy(false)
      }
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [text, value?.place.name])

  return (
    <div className="place" ref={box}>
      <div className="place-shell">
        <span className="place-role">{role}</span>
        <input
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={e => setText(e.target.value)}
          aria-label={placeholder}
        />
        {onClear && value && (
          <button className="place-clear" onClick={() => { setText(''); onClear() }} aria-label="Bỏ chọn">
            Xoá
          </button>
        )}
      </div>

      {value?.nodeId && (
        <p className="place-snap">
          Ghim vào nút giao gần nhất, cách <span className="num">{value.metres}</span> m
        </p>
      )}

      {results && (
        <div className="place-results" role="listbox">
          {busy && <p className="place-empty">Đang tìm…</p>}
          {!busy && failed && <p className="place-empty">Không tra được địa điểm. Kiểm tra mạng rồi gõ lại.</p>}
          {!busy && !failed && results.length === 0 && <p className="place-empty">Không có địa điểm nào khớp.</p>}
          {results.map((r, i) => (
            <button
              key={`${r.lat},${r.lng},${i}`}
              className="place-result"
              onClick={() => { setText(r.name); setResults(null); onPick(r) }}
            >
              <b>{r.name}</b>
              {r.detail && <small>{r.detail}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
