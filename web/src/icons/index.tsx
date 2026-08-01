import type { CSSProperties } from 'react'
import { ICONS, type IconName } from './geometry'

export type { IconName }

interface Props {
  name: IconName
  size?: number
  /** Tô đặc các đầu mối — dùng cho trạng thái đang chọn. */
  solid?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Bộ icon riêng của Route Lab.
 *
 * Vẽ bằng chính từ vựng của bản đồ: thân xe là một nét liền như một cạnh
 * đường, bánh xe là vòng tròn rỗng như một nút đang chờ xét. Chọn phương tiện
 * thì bánh xe tô đặc, đúng như nút chuyển sang trạng thái đã xét.
 *
 * Màu thừa hưởng từ currentColor nên icon tự đổi theo chữ xung quanh, dùng
 * được cả trên nền be lẫn nền mực mà không cần khai báo gì thêm.
 */
export function Icon({ name, size = 20, solid = false, className, style }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true" focusable="false"
    >
      {ICONS[name].map((s, i) =>
        s.t === 'path'
          ? <path key={i} d={s.d} />
          : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.node && solid ? 'currentColor' : 'none'} />,
      )}
    </svg>
  )
}
