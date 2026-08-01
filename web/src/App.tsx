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
        <span className="wordmark">Route <b>Lab</b> <em>· giao hàng</em></span>
        <button className="button" onClick={toggleSync} aria-pressed={syncView}>
          {syncView ? 'Khung nhìn đang đồng bộ' : 'Khung nhìn đang tự do'}
        </button>
        <div className="legend">
          <span><i className="swatch" style={{ background: '#1f9d55' }} /> đường thoáng</span>
          <span><i className="swatch" style={{ background: '#d4342c' }} /> đường kẹt</span>
          <span><i className="swatch hollow" /> đang chờ xét</span>
          <span><i className="swatch" style={{ background: '#3b5bdb' }} /> đã xét</span>
          <span><i className="swatch ink" /> tuyến chọn</span>
        </div>
      </header>

      <div className="shell">
        <Sidebar />

        <main className="stage">
          <div className="grid">
            {panes.length === 0 ? (
              <div className="blank">
                <h1>Chưa có màn hình nào</h1>
                <p>
                  {graph
                    ? 'Mỗi màn hình chạy một thuật toán trên cùng hành trình. Thêm vài màn hình rồi chạy để xem chúng tìm đường khác nhau ra sao.'
                    : 'Chọn điểm lấy hàng và điểm giao ở cột bên trái, dựng mạng lưới đường, rồi thêm màn hình để so sánh các thuật toán.'}
                </p>
                <button className="button solid" onClick={addPane}>Thêm màn hình đầu tiên</button>
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
                  {panes.length >= MAX_PANES ? `Tối đa ${MAX_PANES} màn hình` : 'Thêm màn hình'}
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
