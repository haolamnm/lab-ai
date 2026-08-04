import type { CSSProperties, ReactNode } from 'react'

export interface SegmentOption<T> {
  value: T
  label: string
  icon?: ReactNode
  title?: string
  /** Background color when selected. Leave blank to use ink — the default for
   *  any selector that doesn't need color to tell options apart. */
  hue?: string
}

interface Props<T> {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Number of columns. Leave blank for one column per option. */
  columns?: number
  /** Stack the icon above the label instead of beside it. */
  stacked?: boolean
  label: string
}

/**
 * A segmented button-group selector.
 *
 * Replaces a dropdown wherever there are only a few options: every choice is
 * visible at once so one glance shows them all, and switching takes one click
 * instead of two. A dropdown only earns its place once there are so many
 * options that laying them out would eat all the space.
 */
export function Segment<T extends string | number>({
  options, value, onChange, columns, stacked, label,
}: Props<T>) {
  return (
    <div
      className="segment"
      role="radiogroup"
      aria-label={label}
      data-stacked={stacked || undefined}
      // `minmax(0, 1fr)` rather than `1fr`, which is `minmax(auto, 1fr)` and so
      // refuses to size a column below its label. With the labels set to nowrap
      // that made the row wider than the group, and the `overflow: hidden` that
      // rounds the corners then swallowed the last option whole — a radio the
      // keyboard could reach and the mouse could not see. Now the columns share
      // the width they actually have, and a label too long for its share is
      // truncated inside a button that is still there to click.
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map(o => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title ?? o.label}
          style={o.hue ? ({ '--opt-hue': o.hue } as CSSProperties) : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
