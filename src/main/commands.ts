import type { Engine, FaderMode } from '../core/engine/engine'

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
  // 아래 셋은 엔진이 아니라 출력·설정 명령(메인 index.ts 에서 처리)
  | { t: 'output'; on: boolean }
  | { t: 'dmxPort'; path: string }
  | { t: 'outputOnStart'; on: boolean }

/** 쇼(씬 목록)를 바꾼 명령이면 'showChanged'를 돌려준다 → 메인이 파일에 저장 */
// shortcut: 정식 씬 저장·덮어쓰기·삭제도 아직 PIN 없이 됨, 편집 모드(PIN)를 만들 때 운영 모드에선 임시 씬만 허용
export function runCommand(e: Engine, c: Command, now: number): 'showChanged' | void {
  switch (c.t) {
    case 'saveScene': e.saveScene(c.name, { id: c.id, temp: c.temp }); return 'showChanged'
    case 'renameScene': e.renameScene(c.id, c.name); return 'showChanged'
    case 'deleteScene': e.deleteScene(c.id); return 'showChanged'
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
