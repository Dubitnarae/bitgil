/** 화면 품질: 컴퓨터 사양에 맞춰 3D 화면·화면 갱신 부담을 줄이거나 늘린다. DMX 출력(초당 40번)은 품질과 상관없이 그대로. */
export type Quality = 'low' | 'normal' | 'high'
export type QualitySetting = Quality | 'auto'

export interface QualityPreset {
  /** 3D 해상도 배율(1 = 화면 그대로, 낮을수록 가볍고 흐림). [최소, 최대] 이면 모니터 배율을 따르되 최대까지 */
  dpr: number | [number, number]
  /** 가장자리 계단 현상 줄이기 */
  antialias: boolean
  /** 빛 원뿔·바닥 빛 둘레 조각 수 */
  segments: number
  /** 화면에 상태를 보내는 간격(ms) */
  stateMs: number
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low: { dpr: 0.75, antialias: false, segments: 12, stateMs: 100 },
  normal: { dpr: 1, antialias: true, segments: 24, stateMs: 50 },
  high: { dpr: [1, 2], antialias: true, segments: 32, stateMs: 33 }
}

/** '자동'일 때 CPU 코어 수와 메모리(GB)로 고른다 */
export function autoQuality(cores: number, memGB: number): Quality {
  if (cores <= 4 || memGB < 7.5) return 'low' // 8GB 컴퓨터는 7.8GB 쯤으로 보여서 7.5
  if (cores >= 8 && memGB >= 15) return 'high'
  return 'normal'
}

export function resolveQuality(set: QualitySetting, cores: number, memGB: number): Quality {
  return set === 'auto' ? autoQuality(cores, memGB) : set
}
