import type { Show, Values } from './types'
import { clone, lerpFixture, merge } from './values'
import { buildFrame } from './frame'
import { layerScenes, lerpLevels, type Levels } from './faders'

export type FaderMode = 'live' | 'preview'

/**
 * 상태 엔진. LIVE(실제로 나가는 값)와 PREVIEW(편집 중인 값)를 따로 가진다.
 * 운영 모드 규칙: 모든 변경은 PREVIEW로, [적용]을 눌러야 LIVE로 페이드.
 * 예외: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE. 씬 페이더는 설정(faderMode)에 따라.
 * 실제로 나가는 값 = LIVE 기본 값 위에 씬 페이더를 겹친 것(output).
 */
export class Engine {
  live: Values = {} // 페이드가 끝났을 때의 LIVE 목표값
  preview: Values = {}
  master = 1
  blackout = false
  faders: Levels = {} // LIVE 페이더 위치(페이드가 끝났을 때 목표)
  previewFaders: Levels = {}
  faderMode: FaderMode = 'live'
  private fade: { from: Values; start: number; ms: number } | null = null
  private faderFade: { from: Levels; start: number; ms: number } | null = null
  private raised: Record<string, number> = {} // 페이더를 올린 순서(LTP: 나중에 올린 씬이 이김)
  private tick = 0
  private types

  constructor(public show: Show) {
    this.types = new Map(show.fixture_types.map((t) => [t.id, t]))
  }

  get fading() { return this.fade !== null || this.faderFade !== null }

  /** [적용]하지 않은 변경이 있는지 */
  get pending() {
    return JSON.stringify(this.preview) !== JSON.stringify(this.live) ||
      JSON.stringify(this.previewFaders) !== JSON.stringify(this.faders)
  }

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

  /** 지금 이 순간의 페이더 위치 */
  currentFaders(now: number): Levels {
    if (!this.faderFade) return this.faders
    const t = (now - this.faderFade.start) / this.faderFade.ms
    if (t >= 1) { this.faderFade = null; return this.faders }
    return lerpLevels(this.faderFade.from, this.faders, t)
  }

  /** 실제로 나가는 값 (LIVE + 씬 페이더) */
  output(now: number): Values { return layerScenes(this.show, this.current(now), this.currentFaders(now), this.raised) }

  /** 미리보기 화면에 보일 값 (PREVIEW + 미리보기 페이더) */
  previewOutput(): Values { return layerScenes(this.show, this.preview, this.previewFaders, this.raised) }

  frame(now: number) { return buildFrame(this.show, this.output(now), this.master, this.blackout) }

  /** 씬 페이더 움직이기. 바로 반영 모드면 LIVE와 미리보기를 같이, 아니면 미리보기만. */
  setFader(now: number, sceneId: string, level: number) {
    this.scene(sceneId)
    const v = Math.max(0, Math.min(1, level))
    const target = this.faderMode === 'live' ? this.faders : this.previewFaders
    if (!(target[sceneId] > 0) && v > 0) this.raised[sceneId] = ++this.tick
    if (this.faderMode === 'live') {
      this.faders = { ...this.currentFaders(now), [sceneId]: v }
      this.faderFade = null
    }
    this.previewFaders = { ...this.previewFaders, [sceneId]: v }
  }

  setPreview(ids: string[], attr: string, value: number) {
    const v = Math.max(0, Math.min(255, Math.round(value)))
    for (const id of ids) this.preview[id] = { ...this.preview[id], [attr]: v }
  }

  loadSceneToPreview(sceneId: string) {
    const s = this.scene(sceneId)
    this.preview = merge(this.preview, s.values)
  }

  apply(now: number, fadeSeconds: number) {
    const from = this.currentFaders(now)
    const changed = JSON.stringify(from) !== JSON.stringify(this.previewFaders)
    this.faders = { ...this.previewFaders }
    this.faderFade = changed && fadeSeconds > 0 ? { from: { ...from }, start: now, ms: fadeSeconds * 1000 } : null
    this.fadeTo(now, this.preview, fadeSeconds)
  }

  cancel() {
    this.preview = clone(this.live)
    this.previewFaders = { ...this.faders }
  }

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
