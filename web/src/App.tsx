import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { MapPane } from './components/MapPane'
import { Sidebar } from './components/Sidebar'
import { Explain } from './components/Explain'
import { Compare } from './components/Compare'
import { CompareAlgos } from './components/CompareAlgos'
import { CompareCriteria } from './components/CompareCriteria'
import { Timeline } from './components/Timeline'
import { MAX_PANES, useStore } from './store'

/** ⌘ on a Mac, Ctrl everywhere else — so the tooltip names the key actually pressed. */
const shortcutKey = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
  ? '⌘'
  : 'Ctrl+'

export default function App() {
  const panes = useStore(s => s.panes)
  const graph = useStore(s => s.graph)
  const addPane = useStore(s => s.addPane)
  const reorderPanes = useStore(s => s.reorderPanes)
  const syncView = useStore(s => s.syncView)
  const toggleSync = useStore(s => s.toggleSync)
  const dragging = useRef<string | null>(null)
  // Local, not in the store: nothing outside this component reacts to it, and
  // the sidebar stays mounted either way — so everything typed into it survives
  // being folded away and comes back untouched.
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Cmd/Ctrl+B, the shortcut every editor and shadcn's own sidebar use for this.
  // Guarded on a text field having focus: the sidebar is mostly text fields, and
  // swallowing a keystroke someone meant for the pickup box would be worse than
  // not having the shortcut at all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'b' || !(e.metaKey || e.ctrlKey)) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setSidebarOpen(o => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        {/* A quiet icon at the edge of the header, not a labelled toggle beside
            the Maps one. Those two do different kinds of work: the Maps button
            names a mode you have to reason about, so it says which mode it is
            in; this one just folds a column away, and you can see whether the
            column is there. Giving it the same weight would put a second thing
            in the header competing to be read. */}
        <button
          className="icon-button"
          onClick={() => setSidebarOpen(o => !o)}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          aria-label={sidebarOpen ? 'Hide the sidebar' : 'Show the sidebar'}
          title={`${sidebarOpen ? 'Hide' : 'Show'} the trip and conditions column  (${shortcutKey}B)`}
        >
          <Icon name="panelLeft" size={17} />
        </button>
        <span className="wordmark">Route <b>Lab</b> <em>· delivery</em></span>
        {/* The label used to read "Synced view" / "Independent view", which states
            the mode but not what pressing it would do — and on a filled button
            that reads just as easily as the action itself. Naming the thing being
            synced, and spelling out both the current state and the consequence in
            the tooltip, leaves nothing to infer from the styling. */}
        <button
          className="button"
          onClick={toggleSync}
          aria-pressed={syncView}
          title={syncView
            ? 'Maps are synced: pan or zoom one and every other map follows. Click to let each pane move on its own. The Tree view always keeps its own zoom.'
            : 'Maps move independently. Click to sync them — every pane will jump to the leftmost pane\'s view, and then follow each other.'}
        >
          Maps: {syncView ? 'synced' : 'independent'}
        </button>
        {/* Grouped by when each mark is on screen, because they are not all on
            screen at once. The frontier ring and the expanded dot exist only
            while a search is playing — they are cleared the moment it finishes —
            so listing all seven flat described two of them as though they were
            always there, and left a reader hunting for marks that had already
            done their job and gone. */}
        <div className="legend">
          <span className="legend-group">
            <b>network</b>
            <span><i className="swatch pin-start" /> pickup</span>
            <span><i className="swatch pin-goal" /> dropoff</span>
            <span><i className="swatch jam-clear" /> clear road</span>
            <span><i className="swatch jam-heavy" /> congested road</span>
          </span>
          <span className="legend-group">
            <b>while searching</b>
            <span><i className="swatch hollow" /> frontier</span>
            <span><i className="swatch opened" /> expanded</span>
          </span>
          <span className="legend-group">
            <b>result</b>
            <span><i className="swatch route" /> chosen route</span>
          </span>
        </div>
      </header>

      <div className="shell" data-sidebar={sidebarOpen ? 'open' : 'closed'}>
        <Sidebar />

        <main className="stage">
          <div className="grid">
            {panes.length === 0 ? (
              <div className="blank">
                <h1>No panes yet</h1>
                <p>
                  {graph
                    ? 'Each pane runs one algorithm on the same trip. Add a few panes, then run them to see how differently they find a route.'
                    : 'Choose a pickup and a dropoff in the left-hand column, build the road network, then add panes to compare the algorithms.'}
                </p>
                <button className="button solid" onClick={addPane}>Add the first pane</button>
              </div>
            ) : (
              <>
                {panes.map(p => (
                  <MapPane
                    key={p.id}
                    pane={p}
                    onDragStart={() => { dragging.current = p.id }}
                    onDropOn={() => { if (dragging.current) reorderPanes(dragging.current, p.id) }}
                  />
                ))}
                <button className="pane-add" onClick={addPane} disabled={panes.length >= MAX_PANES}>
                  {panes.length >= MAX_PANES ? `Max ${MAX_PANES} panes` : 'Add pane'}
                </button>
              </>
            )}
          </div>

          {/* The three read-outs share one bounded, scrolling region. Each is a
              fixed-height block that refuses to shrink, so with all three open
              they used to add up to more than the stage had and simply ran off
              the bottom of it. Capping them together means the grid keeps its
              floor, the timeline keeps its place, and any excess becomes a
              scrollbar on the read-outs — which are text, and scroll fine. */}
          <div className="readouts">
            {/* One table per axis the app can vary, in the order the trip is
                set up: which algorithm, then what it is optimising for, then
                what is doing the driving. */}
            <Explain />
            <CompareAlgos />
            <CompareCriteria />
            <Compare />
          </div>
          <Timeline />
        </main>
      </div>
    </div>
  )
}
