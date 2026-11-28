import type { Engine, FaderMode } from '../core/engine/engine'
import type { CueStep, Effect, NamedColor, Venue } from '../core/engine/types'
import { cleanColors } from '../core/engine/color'
import { editFixture, editFixtureType, editVenue, swapFixtures, type FixtureEdit, type TypeEdit } from '../core/engine/patch'

/** 화면 → 메인으로 보내는 명령 */
export type Command =
  | { t: 'set'; ids: string[]; attr: string; value: number }
  | { t: 'selectScene'; id: string }
  | { t: 'clearManual'; ids?: string[]; attrs?: string[] }
  | { t: 'apply'; fade: number }
  | { t: 'cancel' }
  | { t: 'blackout'; on: boolean }
  | { t: 'master'; value: number }
  | { t: 'default' }
  | { t: 'defaultScene'; id: string } // 기본 조명으로 켤 씬 정하기(편집 모드)
  | { t: 'fader'; id: string; value: number }
  | { t: 'fadersDown' }
  | { t: 'faderMode'; mode: FaderMode }
  | { t: 'saveScene'; name: string; id?: string; temp?: boolean }
  | { t: 'renameScene'; id: string; name: string }
  | { t: 'deleteScene'; id: string }
  | { t: 'setEffects'; id: string; effects: Effect[] } // 씬 효과 저장(편집 모드)
  | { t: 'effectDraft'; id: string | null; effects?: Effect[] } // 효과 편집 중 미리보기(null = 끝, 편집 모드)
  | { t: 'cue'; index: number }
  | { t: 'setCuelist'; list: CueStep[] }
  | { t: 'setColors'; list: NamedColor[] } // 색 팔레트의 내 색(운영 모드에서도 가능)
  | { t: 'nextCue' }
  | { t: 'prevCue' }
  | { t: 'autoCue'; on: boolean } // 순서 목록 자동 진행 시작(다음 줄부터 실제 조명)·멈춤
  | { t: 'find'; id: string | null }
  | { t: 'findSet'; attr: string; value: number | null } // 기능 점검: 찾는 조명 채널 값 바꾸기(null = Locate 로)
  | { t: 'chTest'; ch: number | null; value?: number }
  | { t: 'editFixture'; id: string; edit: FixtureEdit }
  | { t: 'swapFixtures'; a: string; b: string }
  | { t: 'editVenue'; venue: Venue }
  | { t: 'editFixtureType'; id: string; edit: TypeEdit }
  // 아래는 엔진이 아니라 출력·설정 명령(메인 index.ts 에서 처리)
  | { t: 'output'; on: boolean }
  | { t: 'dmxPort'; path: string }
  | { t: 'dmxType'; type: import('./dmx/enttec').DmxType }
  | { t: 'dmxTest'; secs: number } // 연결 시험(편집 모드). secs 0 = 지금 멈추고 결과 보기
  | { t: 'outputOnStart'; on: boolean }
  | { t: 'autoUpdate'; on: boolean }
  | { t: 'pinEnabled'; on: boolean } // 편집 모드 PIN 사용(결과를 돌려줘야 해서 ipc 'edit:pinEnabled' 로 받는다)
  | { t: 'checkUpdate' } // 설정의 [지금 확인]
  | { t: 'resume'; on: boolean } // 갑자기 꺼졌던 뒤: 직전 조명 상태로 이어가기(true) / 처음 상태로(false). 운영 모드에서도 가능
  | { t: 'updateChoice'; choice: import('./updater').UpdateChoice } // 운영 모드에서도 가능
  | { t: 'remote'; on: boolean }
  | { t: 'remoteNewCode' } // 원격 접속 코드 새로 만들기(편집 모드)
  | { t: 'quality'; set: import('./quality').QualitySetting }

/** 쇼(씬 목록)를 바꾼 명령이면 'showChanged'를 돌려준다 → 메인이 파일에 저장 */
export function runCommand(e: Engine, c: Command, now: number): 'showChanged' | void {
  switch (c.t) {
    case 'saveScene': e.saveScene(c.name, { id: c.id, temp: c.temp }); return 'showChanged'
    case 'renameScene': e.renameScene(c.id, c.name); return 'showChanged'
    case 'deleteScene': e.deleteScene(c.id); return 'showChanged'
    case 'setEffects': e.setEffects(c.id, c.effects); return 'showChanged'
    case 'effectDraft': return e.setEffectDraft(c.id ? { scene: c.id, effects: c.effects ?? [] } : null)
    case 'defaultScene':
      if (!e.show.scenes.some((s) => s.id === c.id)) throw new Error(`씬을 찾을 수 없음: ${c.id}`)
      e.show.default_scene = c.id
      return 'showChanged'
    case 'setCuelist': e.setCuelist(c.list); return 'showChanged'
    case 'setColors': {
      const list = cleanColors(c.list)
      if (list.length) e.show.colors = list
      else delete e.show.colors // 다 지우면 쇼 파일에서도 뺀다
      return 'showChanged'
    }
    case 'editFixture': editFixture(e.show, c.id, c.edit); return 'showChanged'
    case 'swapFixtures': swapFixtures(e.show, c.a, c.b); return 'showChanged'
    case 'editVenue': editVenue(e.show, c.venue); return 'showChanged'
    case 'editFixtureType': editFixtureType(e.show, c.id, c.edit); return 'showChanged'
    case 'find': return e.setFind(now, c.id)
    case 'findSet': return e.setFindValue(c.attr, c.value)
    case 'chTest': return e.setChTest(c.ch === null ? null : { ch: c.ch, value: c.value ?? 255 })
    case 'cue': e.autoAt = null; return e.loadCue(c.index) // 손으로 고르면 자동 진행은 멈춤
    case 'nextCue': return e.goNextCue(now)
    case 'prevCue': return e.goPrevCue(now)
    case 'autoCue': return e.setAuto(now, c.on)
    case 'set': return e.setPreview(c.ids, c.attr, c.value)
    case 'selectScene': return e.selectScene(c.id)
    case 'clearManual': return e.clearManual(c.ids, c.attrs)
    case 'apply': return e.apply(now, c.fade)
    case 'cancel': return e.cancel()
    case 'blackout': e.blackout = c.on; return
    case 'master': e.master = Math.max(0, Math.min(1, c.value)); return
    case 'fader': return e.setFader(now, c.id, c.value)
    case 'fadersDown': for (const s of e.show.scenes) e.setFader(now, s.id, 0); return
    case 'faderMode': e.faderMode = c.mode; return
    case 'default': {
      // 기본 조명 = 쇼 파일 default_scene(설정에서 고름), 안 정했으면 첫 씬
      const id = e.show.default_scene ?? e.show.scenes[0]?.id
      if (id) e.goScene(now, id)
      e.blackout = false
    }
  }
}
