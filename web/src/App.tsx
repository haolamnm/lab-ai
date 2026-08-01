import { useRef } from 'react'
import { MapPane } from './components/MapPane'
import { Sidebar } from './components/Sidebar'
import { Explain } from './components/Explain'
import { Compare } from './components/Compare'
import { Timeline } from './components/Timeline'
import { MAX_PANES, useStore } from './store'

export default function App() {
  const panes = useStore(s => s.panes)
  const graph = useStore(s => s.graph)
  const addPane = useStore(s => s.addPane)
  const reorderPanes = useStore(s => s.reorderPanes)
  const syncView = useStore(s => s.syncView)
  const toggleSync = useStore(s => s.toggleSync)
  const dragging = useRef<string | null>(null)

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Route <b>Lab</b> <em>· delivery</em></span>
        <button className="button" onClick={toggleSync} aria-pressed={syncView}>
          {syncView ? 'Synced view' : 'Independent view'}
        </button>
        <div className="legend">
          <span><i className="swatch pin-start" /> pickup</span>
          <span><i className="swatch pin-goal" /> dropoff</span>
          <span><i className="swatch" style={{ background: '#1f9d55' }} /> clear road</span>
          <span><i className="swatch" style={{ background: '#d4342c' }} /> congested road</span>
          <span><i className="swatch hollow" /> frontier</span>
          <span><i className="swatch" style={{ background: '#3b5bdb' }} /> expanded</span>
          <span><i className="swatch ink" /> chosen route</span>
        </div>
      </header>

      <div className="shell">
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

          <Explain />
          <Compare />
          <Timeline />
        </main>
      </div>
    </div>
  )
}
