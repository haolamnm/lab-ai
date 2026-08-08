import { useEffect } from 'react'
import { useStore } from '../store'
import { Segment } from './Segment'

/**
 * How long one step is held on screen at normal speed, in milliseconds.
 *
 * Roughly three steps a second: fast enough that a few hundred expansions play
 * out in a sitting, slow enough that the frontier can be watched moving rather
 * than flickering.
 */
const STEP_MS = 340

/** A single timeline drives every pane, so at the same step the viewer can
 *  see which algorithm has already reached the goal and which is still spreading. */
export function Timeline() {
  // One selector per field. A bare useStore() subscribes to the whole store, so
  // dragging a weight slider — which fires on every input event — would re-render
  // the timeline dozens of times a second over state it never reads.
  const step = useStore(s => s.step)
  const maxStep = useStore(s => s.maxStep)
  const playing = useStore(s => s.playing)
  const slowdown = useStore(s => s.slowdown)
  const setStep = useStore(s => s.setStep)
  const setPlaying = useStore(s => s.setPlaying)
  const setSlowdown = useStore(s => s.setSlowdown)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const s = useStore.getState()
      if (s.step >= s.maxStep) { useStore.setState({ playing: false }); return }
      useStore.setState({ step: s.step + 1 })
    }, STEP_MS * slowdown)
    return () => clearInterval(id)
  }, [playing, slowdown])

  const idle = maxStep === 0

  return (
    <div className="timeline" data-idle={idle}>
      <button className="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={idle}>Back</button>
      <button className="button" onClick={() => setPlaying(!playing)} disabled={idle}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button className="button" onClick={() => setStep(Math.min(maxStep, step + 1))} disabled={idle}>Forward</button>

      <span className="counter">
        Step <span className="num">{step}</span> / <span className="num">{maxStep}</span>
      </span>

      <input
        type="range" min={0} max={maxStep} value={step}
        onChange={e => setStep(+e.target.value)}
        aria-label="Algorithm step"
      />

      {/* The stored value multiplies the step delay, so it runs the opposite way
          to the label: 2 is half rate. Named `slowdown` rather than `speed`
          precisely so the identifier stops asserting the opposite of what it does. */}
      <Segment
        label="Playback speed"
        value={slowdown}
        onChange={setSlowdown}
        options={[
          { value: 2, label: '0.5x' }, { value: 1, label: '1x' },
          { value: 0.5, label: '2x' }, { value: 0.25, label: '4x' },
        ]}
      />
    </div>
  )
}
