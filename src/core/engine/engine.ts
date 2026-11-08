import type { Show, Values } from './types'
import { clone, lerpFixture, merge } from './values'
import { buildFrame } from './frame'

/**
 * 상태 엔진. LIVE(실제로 나가는 값)와 PREVIEW(편집 중인 값)를 따로 가진다.
 * 운영 모드 규칙: 모든 변경은 PREVIEW로, [적용]을 눌러야 LIVE로 페이드.
 * 예외: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE.
 */
export class Engine {
  live: Values = {} // 페이드가 끝났을 때의 LIVE 목표값
  preview: Values = {}
  master = 1
  blackout = false
  private fade: { from: Values; start: number; ms: number } | null = null
  private types

  constructor(public show: Show) {
    this.types = new Map(show.fixture_types.map((t) => [t.id, t]))
  }

  get fading() { return this.fade !== null }

  /** 지금 이 순간의 LIVE 값 (페이드 중이면 중간값) */
  current(now: number): Values {
    if (!this.fade) return this.live
    const t = this.fade.ms <= 0 ? 1 : (now - this.fade.start) / this.fade.ms
    if (t >= 1) { this.fade = null; return this.live }
    const out: Values = {}
    for (const f of this.show.fixtures) {
      const type = this.types.get(f.type)
      if (type && (this.fade.from[f.id] || this.live[f.id])) out[f.id] = lerpFixture(type, this.fade.from[f.id], this.live[f.id], t)
    }
    return out
  }

  frame(now: number) { return buildFrame(this.show, this.current(now), this.master, this.blackout) }

  setPreview(ids: string[], attr: string, value: number) {
    const v = Math.max(0, Math.min(255, Math.round(value)))
    for (const id of ids) this.preview[id] = { ...this.preview[id], [attr]: v }
  }

  loadSceneToPreview(sceneId: string) {
    const s = this.scene(sceneId)
    this.preview = merge(this.preview, s.values)
  }

  apply(now: number, fadeSeconds: number) {
    this.fadeTo(now, this.preview, fadeSeconds)
  }

  cancel() { this.preview = clone(this.live) }

  /** 기본 조명: PREVIEW를 거치지 않고 바로 LIVE로. 편집 중이던 PREVIEW도 같이 맞춘다. */
  goScene(now: number, sceneId: string) {
    const s = this.scene(sceneId)
    this.fadeTo(now, merge(this.live, s.values), s.fade_seconds)
    this.preview = clone(this.live)
  }

  private fadeTo(now: number, target: Values, seconds: number) {
    const from = this.current(now)
    this.live = clone(target)
    this.fade = seconds > 0 ? { from: clone(from), start: now, ms: seconds * 1000 } : null
  }

  private scene(id: string) {
    const s = this.show.scenes.find((x) => x.id === id)
    if (!s) throw new Error(`씬을 찾을 수 없음: ${id}`)
    return s
  }
}
