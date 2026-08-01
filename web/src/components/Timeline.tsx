import { useEffect } from 'react'
import { useStore } from '../store'
import { Segment } from './Segment'

/** Một dòng thời gian duy nhất điều khiển mọi màn hình, nên cùng một bước
 *  người xem thấy được thuật toán nào đã tới đích còn thuật toán nào vẫn loang. */
export function Timeline() {
  const { step, maxStep, playing, speed, setStep, setPlaying, setSpeed } = useStore()

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.step >= s.maxStep) { useStore.setState({ playing: false }); return }
      useStore.setState({ step: s.step + 1 })
    }, 340 * speed)
    return () => clearInterval(id)
  }, [playing, speed])

  const idle = maxStep === 0

  return (
    <div className="timeline" data-idle={idle}>
      <button className="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={idle}>Lùi</button>
      <button className="button" onClick={() => setPlaying(!playing)} disabled={idle}>
        {playing ? 'Dừng' : 'Chạy'}
      </button>
      <button className="button" onClick={() => setStep(Math.min(maxStep, step + 1))} disabled={idle}>Tiến</button>

      <span className="counter">
        Bước <span className="num">{step}</span> / <span className="num">{maxStep}</span>
      </span>

      <input
        type="range" min={0} max={maxStep} value={step}
        onChange={e => setStep(+e.target.value)}
        aria-label="Bước của thuật toán"
      />

      <Segment
        label="Tốc độ phát"
        value={speed}
        onChange={setSpeed}
        options={[
          { value: 2, label: '0.5x' }, { value: 1, label: '1x' },
          { value: 0.5, label: '2x' }, { value: 0.25, label: '4x' },
        ]}
      />
    </div>
  )
}
