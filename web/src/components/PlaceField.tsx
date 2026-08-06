import { useEffect, useRef, useState } from 'react'
import { findPlaces } from '../lib/geocode'
import { forgetPlaces, recentPlaces, rememberPlace } from '../lib/recentPlaces'
import type { Place } from '../lib/types'

interface Props {
  role: string
  /** Which endpoint this is, so the field can show the same glyph the map draws. */
  kind: 'start' | 'stop' | 'goal'
  placeholder: string
  value?: { place: Place; nodeId: string | null; metres: number } | null
  autoFocus?: boolean
  onPick: (place: Place) => void
  onClear?: () => void
}

export function PlaceField({ role, kind, placeholder, value, autoFocus, onPick, onClear }: Props) {
  const [text, setText] = useState(value?.place.name ?? '')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  /** The recently picked places, shown instead of results while the box is empty. */
  const [recent, setRecent] = useState<Place[] | null>(null)
  const box = useRef<HTMLDivElement>(null)

  /**
   * Take a place, and remember it for next time.
   *
   * Only picks are recorded, never what was typed: the query is what somebody
   * guessed the place was called, the pick is the place. Storing queries would
   * hand back the misspelling that took three attempts to get right.
   */
  const take = (place: Place) => {
    setText(place.name)
    setResults(null)
    setRecent(null)
    rememberPlace(place)
    onPick(place)
  }

  /** Same button markup for a live result and a recalled one — only the source list differs. */
  const placeButton = (r: Place, i: number) => (
    <button key={`${r.lat},${r.lng},${i}`} className="place-result" onClick={() => take(r)}>
      <b>{r.name}</b>
      {r.detail && <small>{r.detail}</small>}
    </button>
  )

  /** The recently picked places, refetched from storage whenever a reason to show them comes up. */
  const refreshRecent = () => setRecent(recentPlaces())

  useEffect(() => setText(value?.place.name ?? ''), [value?.place.name])

  // Close whichever list is open on an outside click.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setResults(null); setRecent(null) }
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  // Wait for the user to stop typing before querying, and cancel the previous query when a new one starts.
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
        <span className="place-pin" data-kind={kind} aria-hidden="true" />
        <span className="place-role">{role}</span>
        <input
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          // Tied to the box being empty, not to the focus event. Emptying a box
          // that already has the caret in it fires no focus of its own, so
          // hanging this off `onFocus` alone meant that clearing a field — the
          // most likely moment of all to want the history — showed nothing until
          // you clicked away and back again.
          onChange={e => {
            setText(e.target.value)
            setRecent(e.target.value.trim() ? null : recentPlaces())
          }}
          onFocus={() => { if (!text.trim()) refreshRecent() }}
          aria-label={placeholder}
        />
        {onClear && value && (
          <button
            className="place-clear"
            onClick={() => { setText(''); onClear(); refreshRecent() }}
            aria-label="Clear selection"
          >
            Clear
          </button>
        )}
      </div>

      {value?.nodeId && (
        <p className="place-snap">
          Snapped to nearest intersection, <span className="num">{value.metres}</span> m away
        </p>
      )}

      {results && (
        <div className="place-results" role="listbox">
          {busy && <p className="place-empty">Searching…</p>}
          {!busy && failed && <p className="place-empty">Could not look up the location. Check your connection and try again.</p>}
          {!busy && !failed && results.length === 0 && <p className="place-empty">No matching locations.</p>}
          {results.map(placeButton)}
        </div>
      )}

      {/* Never both at once: a live search always wins over the history. */}
      {!results && recent && recent.length > 0 && (
        <div className="place-results" role="listbox">
          <p className="place-recent-head">
            Recent
            <button
              className="place-forget"
              onClick={() => { forgetPlaces(); setRecent(null) }}
              title="Forget every place picked so far"
            >
              Clear
            </button>
          </p>
          {recent.map(placeButton)}
        </div>
      )}
    </div>
  )
}
