import type { NamedColor } from './types'

/** 색 팔레트: 이름과 RGBW 값(0~255). 흰빛은 W 채널을 써서 더 밝고 깨끗하게 */
export const PALETTE: NamedColor[] = [
  { name: '흰색', rgbw: [0, 0, 0, 255] },
  { name: '따뜻한 흰색', rgbw: [255, 120, 20, 200] },
  { name: '빨강', rgbw: [255, 0, 0, 0] },
  { name: '주황', rgbw: [255, 80, 0, 0] },
  { name: '호박색', rgbw: [255, 140, 0, 0] },
  { name: '노랑', rgbw: [255, 220, 0, 0] },
  { name: '초록', rgbw: [0, 255, 0, 0] },
  { name: '청록', rgbw: [0, 255, 200, 0] },
  { name: '하늘색', rgbw: [0, 140, 255, 60] },
  { name: '파랑', rgbw: [0, 0, 255, 0] },
  { name: '보라', rgbw: [120, 0, 255, 0] },
  { name: '자홍', rgbw: [255, 0, 200, 0] },
  { name: '분홍', rgbw: [255, 60, 120, 40] }
]

/** 기본 팔레트 + 내 색: 같은 이름이면 내 값으로 바꾸고(실물에 맞춘 따뜻한 흰색 등), 새 이름은 뒤에 붙인다 */
export function paletteWith(mine: NamedColor[] = []): (NamedColor & { mine: boolean })[] {
  const own = (n: string) => mine.find((m) => m.name === n)
  return [
    ...PALETTE.map((c) => ({ ...(own(c.name) ?? c), mine: !!own(c.name) })),
    ...mine.filter((m) => !PALETTE.some((c) => c.name === m.name)).map((m) => ({ ...m, mine: true }))
  ]
}

/** 지금 조명 값(R·G·B·W)이 이 색인지. W 없는 조명은 W를 R·G·B에 더해 보낸 값과 비교 */
export function sameColor(rgbw: number[], cur: number[], hasW: boolean): boolean {
  return hasW ? rgbw.every((v, i) => v === (cur[i] ?? 0)) : [0, 1, 2].every((i) => Math.min(255, rgbw[i] + rgbw[3]) === (cur[i] ?? 0))
}

/** 저장할 내 색 정리(화면에서 온 값 검사): 이름 앞뒤 공백·빈 이름 빼기, 0~255 정수, 같은 이름은 나중 것, 최대 30개 */
export function cleanColors(list: unknown): NamedColor[] {
  if (!Array.isArray(list)) throw new Error('색 목록이 아님')
  const out = new Map<string, NamedColor>()
  for (const c of list) {
    const name = String(c?.name ?? '').trim().slice(0, 20)
    if (!name || !Array.isArray(c?.rgbw) || c.rgbw.length !== 4) continue
    const v = c.rgbw.map((x: unknown) => Math.max(0, Math.min(255, Math.round(Number(x) || 0))))
    out.delete(name)
    out.set(name, { name, rgbw: v as NamedColor['rgbw'] })
  }
  return [...out.values()].slice(-30)
}

/** '#rrggbb' → R·G·B 중 공통 흰 부분을 W로 옮긴 RGBW */
export function hexToRgbw(hex: string): [number, number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const w = Math.min(r, g, b)
  return [r - w, g - w, b - w, w]
}

/** RGBW → 화면 표시용 '#rrggbb' (W를 R·G·B에 더함) */
export function rgbwToHex([r, g, b, w]: number[]): string {
  return '#' + [r, g, b].map((c) => Math.min(255, c + w).toString(16).padStart(2, '0')).join('')
}
