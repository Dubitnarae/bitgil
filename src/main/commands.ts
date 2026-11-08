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

export function runCommand(e: Engine, c: Command, now: number) {
  switch (c.t) {
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
