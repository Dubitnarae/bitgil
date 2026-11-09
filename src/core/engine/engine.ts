import type { CueStep, Show, Values } from './types'
import { clone, lerpFixture } from './values'
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
  cue = -1 // 순서 목록에서 마지막으로 미리보기에 올린 줄(-1 = 아직 시작 전)
  find: string | null = null // 조명 찾기: 이 조명만 Locate 값으로 켜고 나머지는 끈다(바로 LIVE)
  private findReturn: { from: Values; start: number; ms: number } | null = null
  private fade: { from: Values; start: number; ms: number } | null = null
  private faderFade: { from: Levels; start: number; ms: number } | null = null
  private raised: Record<string, number> = {} // 페이더를 올린 순서(LTP: 나중에 올린 씬이 이김)
  private tick = 0
  private types

  constructor(public show: Show) {
    this.types = new Map(show.fixture_types.map((t) => [t.id, t]))
  }

  get fading() { return this.fade !== null || this.faderFade !== null || this.findReturn !== null }

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
    return this.lerpValues(this.fade.from, this.live, t)
  }

  private lerpValues(from: Values, to: Values, t: number): Values {
    const out: Values = {}
    for (const f of this.show.fixtures) {
      const type = this.types.get(f.type)
      if (type && (from[f.id] || to[f.id])) out[f.id] = lerpFixture(type, from[f.id], to[f.id], t)
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

  /** 실제로 나가는 값 (LIVE + 씬 페이더). 조명 찾기 중이면 찾는 조명만, 끝난 직후 2초는 원래 상태로 페이드. */
  output(now: number): Values {
    if (this.find) return this.findValues()
    const out = layerScenes(this.show, this.current(now), this.currentFaders(now), this.raised)
    const r = this.findReturn
    if (!r) return out
    const t = (now - r.start) / r.ms
    if (t >= 1) { this.findReturn = null; return out }
    // 원래 상태에 없는 값은 '유지'가 아니라 0(꺼짐)으로 내려가야 한다
    const to: Values = { ...out }
    for (const [id, v] of Object.entries(r.from)) to[id] = { ...Object.fromEntries(Object.keys(v).map((k) => [k, 0])), ...out[id] }
    return this.lerpValues(r.from, to, t)
  }

  /** 조명 찾기 시작·바꾸기(id) 또는 끝내기(null). 끝내면 들어가기 전 조명 상태로 2초 페이드. */
  setFind(now: number, id: string | null) {
    if (id && !this.show.fixtures.some((f) => f.id === id)) throw new Error(`조명을 찾을 수 없음: ${id}`)
    if (!id && this.find) this.findReturn = { from: this.findValues(), start: now, ms: 2000 }
    this.find = id
  }

  private findValues(): Values {
    const f = this.show.fixtures.find((x) => x.id === this.find)
    const type = f && this.types.get(f.type)
    if (!f || !type) return {}
    return { [f.id]: Object.fromEntries(type.channels.filter((c) => c.locate !== undefined).map((c) => [c.attr, c.locate!])) }
  }

  /** 미리보기 화면에 보일 값 (PREVIEW + 미리보기 페이더) */
  previewOutput(): Values { return layerScenes(this.show, this.preview, this.previewFaders, this.raised) }

  // 찾기 중에는 전체 밝기를 무시(0%여도 보여야 함). 블랙아웃은 그대로 우선.
  frame(now: number) { return buildFrame(this.show, this.output(now), this.find ? 1 : this.master, this.blackout) }

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

  /** 씬 버튼: 미리보기에서 그 씬 페이더만 100%, 나머지는 0. [적용]해야 나간다. */
  selectScene(sceneId: string) {
    this.scene(sceneId)
    if (!(this.previewFaders[sceneId] > 0)) this.raised[sceneId] = ++this.tick
    this.previewFaders = this.only(sceneId)
  }

  /** 손으로 조정한 값 지우기(미리보기). ids가 없으면 전부, attrs가 있으면 그 속성만. */
  clearManual(ids?: string[], attrs?: string[]) {
    if (!ids?.length) { this.preview = {}; return }
    this.preview = clone(this.preview)
    for (const id of ids) {
      if (!attrs) { delete this.preview[id]; continue }
      for (const a of attrs) delete this.preview[id]?.[a]
      if (this.preview[id] && !Object.keys(this.preview[id]).length) delete this.preview[id]
    }
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

  /**
   * 기본 조명: PREVIEW를 거치지 않고 바로 LIVE로. 그 씬 페이더만 100%, 손으로 조정한 값은 모두 지운다.
   */
  // shortcut: 손으로 조정한 값은 페이드 없이 바로 사라짐, 튀는 게 거슬리면 화면 출력값 기준 페이드로 바꿈
  goScene(now: number, sceneId: string) {
    const s = this.scene(sceneId)
    if (!(this.faders[sceneId] > 0)) this.raised[sceneId] = ++this.tick
    const from = this.currentFaders(now)
    this.faders = this.only(sceneId)
    this.previewFaders = { ...this.faders }
    this.faderFade = s.fade_seconds > 0 ? { from: { ...from }, start: now, ms: s.fade_seconds * 1000 } : null
    this.live = {}
    this.preview = {}
    this.fade = null
  }

  /**
   * 지금 미리보기 화면에 보이는 값(PREVIEW + 미리보기 페이더)을 씬으로 저장한다.
   * id를 주면 그 씬을 덮어쓰고(이름은 그대로), 없으면 새 씬을 만든다. 저장한 씬 id를 돌려준다.
   */
  saveScene(name: string, opts: { id?: string; temp?: boolean } = {}): string {
    const values = clone(this.previewOutput())
    if (opts.id) {
      this.scene(opts.id).values = values
      return opts.id
    }
    const prefix = opts.temp ? 'T-' : 'U-'
    const n = Math.max(0, ...this.show.scenes.filter((x) => x.id.startsWith(prefix)).map((x) => Number(x.id.slice(2)) || 0)) + 1
    const id = prefix + String(n).padStart(2, '0')
    this.show.scenes.push({ id, name: name.trim() || id, fade_seconds: 2, values, ...(opts.temp ? { temp: true } : {}) })
    return id
  }

  /** 순서 목록 i번째 줄을 미리보기에 올린다(씬 버튼과 같음). [적용]해야 나간다. */
  loadCue(i: number) {
    const step = this.show.cuelist[i]
    if (!step) throw new Error(`순서 목록에 ${i + 1}번째 줄이 없음`)
    this.selectScene(step.scene)
    this.cue = i
  }

  /** 폰 [다음 씬]: 순서 목록 다음 줄을 올리고 그 줄 페이드로 바로 [적용]. 마지막 줄이면 아무것도 안 함. */
  goNextCue(now: number) {
    const i = this.cue + 1
    if (!this.show.cuelist[i]) return
    this.loadCue(i)
    this.apply(now, this.show.cuelist[i].fade)
  }

  /** 순서 목록 통째로 바꾸기(추가·삭제·순서·페이드). 없는 씬은 뺀다. */
  setCuelist(list: CueStep[]) {
    this.show.cuelist = list
      .filter((c) => this.show.scenes.some((s) => s.id === c.scene))
      .map((c) => ({ scene: c.scene, fade: Math.max(0, Math.min(60, Number(c.fade) || 0)) }))
    this.cue = Math.min(this.cue, this.show.cuelist.length - 1)
  }

  renameScene(id: string, name: string) {
    if (name.trim()) this.scene(id).name = name.trim()
  }

  deleteScene(id: string) {
    this.scene(id)
    this.show.scenes = this.show.scenes.filter((x) => x.id !== id)
    this.setCuelist(this.show.cuelist) // 지운 씬을 쓰던 순서 줄도 뺀다
    for (const m of [this.faders, this.previewFaders, this.raised]) delete m[id]
    if (this.show.default_scene === id) delete this.show.default_scene
  }

  private only(sceneId: string): Levels {
    return Object.fromEntries(this.show.scenes.map((x) => [x.id, x.id === sceneId ? 1 : 0]))
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
