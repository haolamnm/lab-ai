/**
 * Xuất cả bộ icon ra một bản SVG rời để soi bằng mắt: mỗi icon hiện hai lần,
 * nét trên nền be và tô đặc trên nền mực, đúng hai trạng thái dùng thật.
 *
 * Chạy:
 *   npx esbuild src/icons/makeSheet.ts --bundle --platform=node --format=esm \
 *     --outfile=/tmp/sheet.mjs && node /tmp/sheet.mjs src/icons/sheet.svg
 */
import { writeFileSync } from 'node:fs'
import { ICONS, type IconName, type Shape } from './geometry'

const render = (shapes: Shape[], solid: boolean) => shapes.map(s =>
  s.t === 'path'
    ? `<path d="${s.d}"/>`
    : `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"${s.node && solid ? ' fill="currentColor"' : ''}/>`
).join('')

const names = Object.keys(ICONS) as IconName[]
const COL = 5, CELL = 108, PAD = 16
const rows = Math.ceil(names.length / COL) * 2   // hàng trên nét, hàng dưới đặc
let body = ''
names.forEach((n, i) => {
  for (const solid of [false, true]) {
    const col = i % COL
    const row = Math.floor(i / COL) * 2 + (solid ? 1 : 0)
    const x = PAD + col * CELL, y = PAD + row * CELL
    const dark = solid
    body += `<g transform="translate(${x},${y})">
      <rect width="${CELL - 12}" height="${CELL - 30}" rx="6" fill="${dark ? '#23201b' : '#fbf8f2'}" stroke="#e0d8c8"/>
      <g transform="translate(${(CELL - 12) / 2 - 24},${(CELL - 30) / 2 - 24}) scale(2)"
         fill="none" stroke="${dark ? '#fbf8f2' : '#23201b'}" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round" color="${dark ? '#fbf8f2' : '#23201b'}">
        ${render(ICONS[n], solid)}
      </g>
      <text x="${(CELL - 12) / 2}" y="${CELL - 14}" font-family="monospace" font-size="11"
            fill="#857d6e" text-anchor="middle">${n}${solid ? ' ·chọn' : ''}</text>
    </g>`
  }
})
const w = PAD * 2 + COL * CELL, h = PAD * 2 + rows * CELL
writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#f0eadd"/>${body}</svg>`)
console.log('đã ghi', process.argv[2])
