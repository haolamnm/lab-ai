import type { CSSProperties } from 'react'
import type { VehicleKey } from '../lib/types'
import { ICONS, type IconName } from './geometry'

export type { IconName }

/**
 * Which glyph stands for each vehicle. Lives here rather than in a component
 * because both the sidebar and the comparison table draw it; two copies means
 * a fifth vehicle shows up with an icon in one place and nothing in the other.
 */
export const VEHICLE_ICON: Record<VehicleKey, IconName> = {
  bike: 'scooter', van: 'van', car: 'car', truck: 'truck',
}

interface Props {
  name: IconName
  size?: number
  /** Fills the endpoints in solid — used for the selected state. */
  solid?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Route Lab's own icon set.
 *
 * Drawn in the map's own vocabulary: the vehicle body is a single continuous stroke, like a
 * road segment; the wheels are hollow circles, like a node still waiting to be examined.
 * Selecting a vehicle fills its wheels solid, exactly like a node switching over to the
 * expanded state.
 *
 * Colour is inherited from currentColor, so the icon follows the surrounding text
 * automatically, and works on both the beige and the ink background without declaring
 * anything extra.
 */
export function Icon({ name, size = 20, solid = false, className, style }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true" focusable="false"
    >
      {/* Keyed by position, which here genuinely is the identity: one glyph's
          shape list is a fixed literal that is never reordered or filtered. */}
      {ICONS[name].map((s, i) =>
        s.t === 'path'
          ? <path key={i} d={s.d} />
          : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.node && solid ? 'currentColor' : 'none'} />,
      )}
    </svg>
  )
}
