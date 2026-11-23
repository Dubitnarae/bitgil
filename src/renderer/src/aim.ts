import type { Show, Vec3 } from '../../core/engine/types'
import { panTiltFor } from '../../core/engine/visual'
import { floorLift, shapeOf } from './3d/FixtureBody'
import { send, type State } from './api'

/** 되돌리기 한 칸: 그 전의 저장 안 한 조준점 + 무빙 팬·틸트(또는 저장한 조준점)를 되돌리는 함수. save = 쇼 파일을 고치므로 편집 모드에서만 */
interface Step { drafts: Record<string, Vec3>; undo?: () => void; save?: boolean }

/** 빛 위치 찍기 상태(켜져 있는 동안). 고정 조명 조준점은 [저장] 전까지 drafts 에만 있다. */
export interface Aim { msg: string; drafts: Record<string, Vec3>; history: Step[] }

const MAX_UNDO = 50
export const aimStart = (): Aim => ({ msg: '', drafts: {}, history: [] })

/**
 * 고른 조명들을 p 로 향하게 한다.
 * 무빙 = 미리보기 팬·틸트([적용]해야 나감), 고정 = 저장 안 한 조준점(편집 모드, [저장]해야 쇼 파일에).
 */
export function aimAt(show: Show, st: State, ids: string[], p: Vec3, a: Aim): Aim {
  const undos: (() => void)[] = []
  const drafts = { ...a.drafts }
  const moved: string[] = []
  const far: string[] = []
  const fixed: string[] = []
  const locked: string[] = []
  for (const id of ids) {
    const f = show.fixtures.find((x) => x.id === id)
    const type = f && show.fixture_types.find((t) => t.id === f.type)
    if (!f || !type) continue
    if (f.direction === 'pan_tilt') {
      // 빛이 나오는 곳 = 3D에서 그리는 렌즈 위치(바닥 조명은 조금 올라가 있음)
      const origin = { ...f.position, y: f.position.y + (f.mount === 'floor' ? floorLift(shapeOf(type)) : 0) }
      const v = panTiltFor(type, origin, p, st.previewOut[id])
      if (!v) { far.push(id); continue }
      const before = { ...st.preview[id] } // 손으로 조정한 값만(씬 값은 지우면 돌아옴)
      const unset = Object.keys(v).filter((k) => before[k] === undefined)
      undos.push(() => {
        for (const k of Object.keys(v)) if (before[k] !== undefined) send({ t: 'set', ids: [id], attr: k, value: before[k] })
        if (unset.length) send({ t: 'clearManual', ids: [id], attrs: unset })
      })
      for (const [attr, value] of Object.entries(v)) send({ t: 'set', ids: [id], attr, value })
      moved.push(id)
    } else if (st.editMode) {
      drafts[id] = p
      fixed.push(id)
    } else locked.push(id)
  }
  const at = `(${p.x}, ${p.y}, ${p.z})`
  const names = (l: string[]) => (l.length > 4 ? `${l.slice(0, 3).join(', ')} 외 ${l.length - 3}대` : l.join(', '))
  const msg = [
    moved.length && `무빙 ${names(moved)} → ${at} 미리보기, [적용]해야 나갑니다`,
    fixed.length && `고정 ${names(fixed)} → ${at}, [저장]해야 저장됩니다`,
    far.length && `${names(far)}: 틸트 범위 밖이라 못 비춤`,
    locked.length && `${names(locked)}: 고정 조명 각도 보정은 편집 모드에서만`
  ].filter(Boolean).join(' · ')
  if (!moved.length && !fixed.length) return { ...a, msg }
  const step: Step = { drafts: a.drafts, undo: undos.length ? () => undos.forEach((u) => u()) : undefined }
  return { msg, drafts, history: [...a.history, step].slice(-MAX_UNDO) }
}

/** 한 번 찍기 전으로 */
export function aimUndo(a: Aim): Aim {
  const last = a.history.at(-1)
  if (!last) return a
  last.undo?.()
  const history = a.history.slice(0, -1)
  return { msg: `${last.save ? '저장을 되돌렸습니다(조준점은 저장 전 찍은 상태로, 다시 [저장] 가능)' : '한 번 되돌렸습니다'}${history.length ? ` (더 되돌릴 수 있음 ${history.length}번)` : ' (처음 상태)'}`, drafts: last.drafts, history }
}

/** 저장 안 한 고정 조명 조준점을 쇼 파일에 저장. 저장도 한 칸으로 남겨 [되돌리기]로 원래 방향·조준점을 다시 저장할 수 있다. */
export function aimSave(a: Aim, show: Show): Aim {
  const ids = Object.keys(a.drafts)
  const before = ids.map((id) => { const f = show.fixtures.find((x) => x.id === id)!; return { id, direction: f.direction, aim: f.aim } })
  for (const id of ids) send({ t: 'editFixture', id, edit: { direction: 'aimed', aim: a.drafts[id] } })
  const restore = () => before.forEach((b) => send({ t: 'editFixture', id: b.id, edit: { direction: b.direction, aim: b.aim } }))
  // 저장 전 칸들의 조준점은 이미 저장됐으므로 무빙 되돌리기만 남긴다
  const history = a.history.filter((h) => h.undo).map((h) => ({ ...h, drafts: {} }))
  return { msg: `고정 ${ids.length}대 조준점을 저장했습니다. 잘못 저장했으면 [되돌리기]`, drafts: {}, history: [...history, { drafts: a.drafts, undo: restore, save: true }].slice(-MAX_UNDO) }
}

/** 마지막 칸이 저장이면 편집 모드에서만 되돌릴 수 있다 */
export const canUndo = (a: Aim, editMode: boolean) => a.history.length > 0 && (editMode || !a.history.at(-1)!.save)

/** 3D 화면용: 저장 안 한 조준점을 반영한 쇼(원본은 그대로) */
export function withDrafts(show: Show, drafts: Record<string, Vec3>): Show {
  if (!Object.keys(drafts).length) return show
  return { ...show, fixtures: show.fixtures.map((f) => (drafts[f.id] ? { ...f, direction: 'aimed' as const, aim: drafts[f.id] } : f)) }
}
