/**
 * Hình học của bộ icon riêng.
 *
 * Cả bộ dựng trên lưới 24×24, nét 1.6, đầu nét bo tròn, và tuân một luật duy
 * nhất: **icon nói bằng đúng từ vựng của bản đồ.** Thân xe là một nét liền,
 * như một cạnh đường; bánh xe là vòng tròn rỗng, như một nút đang nằm trong
 * hàng đợi biên. Khi phương tiện được chọn, bánh xe tô đặc — đúng lúc nút trên
 * bản đồ chuyển từ "đang chờ xét" sang "đã xét".
 *
 * Nhờ vậy bộ icon không phải đồ trang trí mượn từ nơi khác, mà là phần kéo dài
 * của chính hệ ký hiệu người dùng đang đọc trên bản đồ.
 *
 * Tách riêng khỏi phần React để vừa vẽ ra giao diện, vừa xuất được thành bản
 * SVG rời đem đi kiểm tra bằng mắt.
 */

export type Shape =
  | { t: 'path'; d: string }
  /** node: true nghĩa là bánh xe hoặc đầu mối — tô đặc khi được chọn. */
  | { t: 'circle'; cx: number; cy: number; r: number; node?: boolean }

export type IconName =
  | 'scooter' | 'van' | 'car' | 'truck'
  | 'peak' | 'offpeak' | 'night'
  | 'trunkRoads' | 'midRoads' | 'smallRoads' | 'alleys'

export const ICONS: Record<IconName, Shape[]> = {
  /* ---------- Phương tiện ---------- */

  // Xe máy: tay lái, thân dốc xuống sàn để chân, yên nhô lên phía sau.
  scooter: [
    { t: 'path', d: 'M6.2 7.2h3.4' },
    { t: 'path', d: 'M8.3 7.6 7.3 12.6' },
    { t: 'path', d: 'M7.3 12.6 6.9 14.5' },
    { t: 'path', d: 'M7.3 12.6c-.1 1.6.8 2.6 2.3 2.6h3' },
    { t: 'path', d: 'M12.6 15.2 14.3 10.8h3.1c2.1 0 3.5 1.7 3.5 3.8v.6' },
    { t: 'circle', cx: 6.9, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.9, cy: 16.8, r: 2.4, node: true },
  ],

  // Xe van: thùng hàng cao phía sau, ca-bin vát ngắn phía trước.
  van: [
    { t: 'path', d: 'M3 15.3V9.5c0-1.2 1-2.2 2.2-2.2h6.9l4.5 4h1.5c1.2 0 2.2 1 2.2 2.2v1.8' },
    { t: 'path', d: 'M12.1 7.3v4h4.5' },
    { t: 'path', d: 'M3 15.3h1.5M10 15.3h5.1M19.9 15.3h.4' },
    { t: 'circle', cx: 7.1, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.5, cy: 16.8, r: 2.4, node: true },
  ],

  // Ô tô con: một nét mui liền từ đuôi qua nóc tới mũi.
  car: [
    { t: 'path', d: 'M2.9 15.1v-2.4l2.7-4.1c.36-.55.9-.83 1.6-.83h6.6c.55 0 1 .2 1.4.62l3.1 3.8 1.6.5c.7.22 1.1.75 1.1 1.5v.95' },
    { t: 'path', d: 'M2.9 15.1h1.4M9.8 15.1h4.1M19.6 15.1h1.4' },
    { t: 'path', d: 'M6.9 12.2h9.4' },
    { t: 'circle', cx: 7.1, cy: 16.4, r: 2.4, node: true },
    { t: 'circle', cx: 16.7, cy: 16.4, r: 2.4, node: true },
  ],

  // Xe tải: thùng vuông vức, ca-bin thấp hơn thùng.
  truck: [
    { t: 'path', d: 'M2.5 15.2V6.4h9.1v8.8' },
    { t: 'path', d: 'M13.5 15.2v-4.4h3.1l3.2 3.1v1.3' },
    { t: 'path', d: 'M2.5 15.2h1.4M8.6 15.2h6.9M19.8 15.2h.4' },
    { t: 'circle', cx: 6.2, cy: 16.8, r: 2.4, node: true },
    { t: 'circle', cx: 17.5, cy: 16.8, r: 2.4, node: true },
  ],

  /* ---------- Khung giờ ---------- */

  // Cao điểm: mặt trời đứng bóng, tám tia đều.
  peak: [
    { t: 'circle', cx: 12, cy: 12, r: 3.9, node: true },
    { t: 'path', d: 'M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2' },
    { t: 'path', d: 'M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6' },
  ],

  // Thấp điểm: mặt trời lặn xuống dưới đường chân trời.
  offpeak: [
    { t: 'path', d: 'M3.4 17.6h17.2' },
    { t: 'path', d: 'M7.6 17.6a4.4 4.4 0 0 1 8.8 0' },
    { t: 'path', d: 'M12 3.4v2.1M4.9 7.2l1.5 1.5M19.1 7.2l-1.5 1.5' },
    { t: 'path', d: 'M6.6 20.6h3.1M14.3 20.6h3.1' },
  ],

  // Ban đêm: trăng khuyết cùng một ngôi sao nhỏ.
  night: [
    { t: 'path', d: 'M19.3 14.4a8 8 0 0 1-9.7-9.7 8 8 0 1 0 9.7 9.7Z' },
    { t: 'path', d: 'M17.4 3.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z' },
  ],

  /* ---------- Mức chi tiết mạng lưới ---------- */
  /* Ba icon này vẽ thẳng cái mà chúng mô tả: một mạng lưới mỗi lúc một dày. */

  trunkRoads: [
    { t: 'path', d: 'M3.5 12h17M12 3.5v17' },
    { t: 'circle', cx: 12, cy: 12, r: 2.3, node: true },
  ],

  midRoads: [
    { t: 'path', d: 'M3.5 6h17M3.5 12h17M3.5 18h17' },
    { t: 'path', d: 'M6 3.5v17M12 3.5v17M18 3.5v17' },
    { t: 'circle', cx: 12, cy: 12, r: 1.9, node: true },
  ],

  smallRoads: [
    { t: 'path', d: 'M3.2 4.5h17.6M3.2 8.7h17.6M3.2 12.9h17.6M3.2 17.1h17.6' },
    { t: 'path', d: 'M4.5 3.2v17.6M8.7 3.2v17.6M12.9 3.2v17.6M17.1 3.2v17.6' },
    { t: 'circle', cx: 12.9, cy: 12.9, r: 1.5, node: true },
  ],

  // Hẻm không phải một lưới dày hơn nữa — dày thêm nữa thì ba icon kia đã nói
  // hết. Hẻm là những nhánh cụt đâm ra từ mặt phố, nên vẽ đúng thế: hai con phố,
  // một đường nối, và mấy nhánh ngắn thò vào trong không dẫn đi đâu cả.
  alleys: [
    { t: 'path', d: 'M3.6 7h16.8M3.6 17h16.8' },
    { t: 'path', d: 'M7 3.6v16.8M17 3.6v16.8' },
    { t: 'path', d: 'M11 7v4.4' },
    { t: 'path', d: 'M14.6 17v-3.1' },
    { t: 'path', d: 'M7 13.4h3.1' },
    { t: 'circle', cx: 12, cy: 12, r: 1.5, node: true },
  ],
}
