/**
 * 소리 반응: 노트북 마이크 크기 → 전체 밝기 배율(0~1).
 * 배율은 최소 밝기(floor) 아래로 내려가지 않는다. 위로는 전체 밝기 막대가 상한(엔진이 곱함).
 */

/** 마이크 크기(RMS 0~1) → 배율. sens 0~100(클수록 작은 소리에도 밝아짐), floor 0~1 */
export function soundFactor(rms: number, sens: number, floor: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-6))
  const lo = -30 - (Math.max(0, Math.min(100, sens)) / 100) * 40 // 둔감 -30dB ~ 예민 -70dB 부터 밝아지기 시작
  const loud = Math.max(0, Math.min(1, (db - lo) / 30)) // 그보다 30dB 크면 100%
  const f = Math.max(0, Math.min(1, floor))
  return f + (1 - f) * loud
}

/** 빨리 밝아지고 천천히 어두워지게(박자에 튀지만 말 사이사이 깜빡이지 않게) */
export const smooth = (prev: number, next: number) => prev + (next - prev) * (next > prev ? 0.6 : 0.12)

/** 마이크를 열고 40ms 마다 onRms(0~1)를 부른다. 돌려준 함수로 멈춤. 마이크가 없거나 막히면 오류 */
export async function startMic(onRms: (rms: number) => void): Promise<() => void> {
  // 소리 크기를 그대로 재야 하므로 잡음 제거·자동 음량은 끈다
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const ctx = new AudioContext()
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(an)
  const buf = new Float32Array(an.fftSize)
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(buf)
    let s = 0
    for (const v of buf) s += v * v
    onRms(Math.sqrt(s / buf.length))
  }, 40)
  return () => {
    clearInterval(timer)
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }
}
