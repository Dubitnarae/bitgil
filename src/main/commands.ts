import type { Engine, FaderMode } from '../core/engine/engine'
import type { CueStep, Venue } from '../core/engine/types'
import { editFixture, editFixtureType, editVenue, swapFixtures, type FixtureEdit, type TypeEdit } from '../core/engine/patch'

/** 화면 → 메인으로 보내는 명령 */
export type Command =
  | { t: 'set'; ids: string[]; attr: string; value: number }
  | { t: 'selectScene'; id: string }
  | { t: 'clearManual'; ids?: string[] }
  | { t: 'apply'; fade: number }
  | { t: 'cancel' }
  | { t: 'blackout'; on: boolean }
  | { t: 'master'; value: number }
  | { t: 'default' }
  | { t: 'fader'; id: string; value: number }
  | { t: 'fadersDown' }
  | { t: 'faderMode'; mode: FaderMode }
  | { t: 'saveScene'; name: string; id?: string; temp?: boolean }
  | { t: 'renameScene'; id: string; name: string }
  | { t: 'deleteScene'; id: string }
  | { t: 'cue'; index: number }
  | { t: 'setCuelist'; list: CueStep[] }
  | { t: 'nextCue' }
  | { t: 'find'; id: string | null }
  | { t: 'editFixture'; id: string; edit: FixtureEdit }
  | { t: 'swapFixtures'; a: string; b: string }
  | { t: 'editVenue'; venue: Venue }
  | { t: 'editFixtureType'; id: string; edit: TypeEdit }
  // 아래 넷은 엔진이 아니라 출력·설정 명령(메인 index.ts 에서 처리)
  | { t: 'output'; on: boolean }
  | { t: 'dmxPort'; path: string }
  | { t: 'outputOnStart'; on: boolean }
  | { t: 'autoUpdate'; on: boolean }
  | { t: 'remote'; on: boolean }

/** 쇼(씬 목록)를 바꾼 명령이면 'showChanged'를 돌려준다 → 메인이 파일에 저장 */
export function runCommand(e: Engine, c: Command, now: number): 'showChanged' | void {
  switch (c.t) {
    case 'saveScene': e.saveScene(c.name, { id: c.id, temp: c.temp }); return 'showChanged'
    case 'renameScene': e.renameScene(c.id, c.name); return 'showChanged'
    case 'deleteScene': e.deleteScene(c.id); return 'showChanged'
    case 'setCuelist': e.setCuelist(c.list); return 'showChanged'
    case 'editFixture': editFixture(e.show, c.id, c.edit); return 'showChanged'
    case 'swapFixtures': swapFixtures(e.show, c.a, c.b); return 'showChanged'
    case 'editVenue': editVenue(e.show, c.venue); return 'showChanged'
    case 'editFixtureType': editFixtureType(e.show, c.id, c.edit); return 'showChanged'
    case 'find': return e.setFind(now, c.id)
    case 'cue': return e.loadCue(c.index)
    case 'nextCue': return e.goNextCue(now)
    case 'set': return e.setPreview(c.ids, c.attr, c.value)
    case 'selectScene': return e.selectScene(c.id)
    case 'clearManual': return e.clearManual(c.ids)
    case 'apply': return e.apply(now, c.fade)
    case 'cancel': return e.cancel()
    case 'blackout': e.blackout = c.on; return
    case 'master': e.master = Math.max(0, Math.min(1, c.value)); return
    case 'fader': return e.setFader(now, c.id, c.value)
    case 'fadersDown': for (const s of e.show.scenes) e.setFader(now, s.id, 0); return
    case 'faderMode': e.faderMode = c.mode; return
    case 'default': {
      // shortcut: 기본 조명 = 쇼 파일 default_scene, 없으면 첫 씬. 설정 화면에서 고르는 기능은 다음 단계
      const id = e.show.default_scene ?? e.show.scenes[0]?.id
      if (id) e.goScene(now, id)
      e.blackout = false
    }
  }
}
