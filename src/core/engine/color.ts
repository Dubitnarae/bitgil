/** 색 팔레트: 이름과 RGBW 값(0~255). 흰빛은 W 채널을 써서 더 밝고 깨끗하게 */
export const PALETTE: { name: string; rgbw: [number, number, number, number] }[] = [
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
