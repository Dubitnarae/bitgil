import type { Show, Vec3 } from '../../core/engine/types'
import { panTiltFor } from '../../core/engine/visual'
import { floorLift, shapeOf } from './3d/FixtureBody'
import { send, type State } from './api'

/**
 * 빛 위치 찍기: 고른 조명들을 p 로 향하게 한다. 결과 문구와, 찍기 전으로 되돌리는 함수(바뀐 게 없으면 없음)를 돌려준다.
 * 무빙 = 미리보기 팬·틸트([적용]해야 나감), 고정식 = 조준점 저장(편집 모드 전용, 쇼 파일에 저장).
 */
export interface Aim { msg: string; undo?: () => void }

export function aimAt(show: Show, st: State, ids: string[], p: Vec3): Aim {
  const undos: (() => void)[] = []
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
      const unset = Object.keys(v).filter((a) => before[a] === undefined)
      undos.push(() => {
        for (const a of Object.keys(v)) if (before[a] !== undefined) send({ t: 'set', ids: [id], attr: a, value: before[a] })
        if (unset.length) send({ t: 'clearManual', ids: [id], attrs: unset })
      })
      for (const [attr, value] of Object.entries(v)) send({ t: 'set', ids: [id], attr, value })
      moved.push(id)
    } else if (st.editMode) {
      const { direction, aim } = f
      undos.push(() => send({ t: 'editFixture', id, edit: { direction, aim } }))
      send({ t: 'editFixture', id, edit: { direction: 'aimed', aim: p } })
      fixed.push(id)
    } else locked.push(id)
  }
  const at = `(${p.x}, ${p.y}, ${p.z})`
  const names = (l: string[]) => (l.length > 4 ? `${l.slice(0, 3).join(', ')} 외 ${l.length - 3}대` : l.join(', '))
  const msg = [
    moved.length && `무빙 ${names(moved)} → ${at} 미리보기, [적용]해야 나갑니다`,
    fixed.length && `고정 ${names(fixed)} 조준점 ${at} 저장`,
    far.length && `${names(far)}: 틸트 범위 밖이라 못 비춤`,
    locked.length && `${names(locked)}: 고정 조명 각도 보정은 편집 모드에서만`
  ].filter(Boolean).join(' · ')
  return { msg, undo: undos.length ? () => undos.forEach((u) => u()) : undefined }
}
