import type { CSSProperties, ReactNode } from 'react'

export interface SegmentOption<T> {
  value: T
  label: string
  icon?: ReactNode
  title?: string
  /** Màu nền khi được chọn. Bỏ trống thì dùng mực — mặc định cho mọi bộ chọn
   *  không cần phân biệt bằng màu. */
  hue?: string
}

interface Props<T> {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Số cột. Bỏ trống thì mỗi lựa chọn một cột. */
  columns?: number
  /** Xếp biểu tượng lên trên nhãn thay vì nằm cạnh. */
  stacked?: boolean
  label: string
}

/**
 * Bộ chọn dạng nút liền khối.
 *
 * Thay cho danh sách thả xuống ở những chỗ chỉ có vài lựa chọn: mọi phương án
 * hiện sẵn nên đọc một lần là biết hết, và đổi chỉ mất một cú bấm thay vì hai.
 * Danh sách thả xuống chỉ đáng dùng khi lựa chọn nhiều tới mức bày ra sẽ chiếm
 * hết chỗ.
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
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, 1fr)` }}
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
