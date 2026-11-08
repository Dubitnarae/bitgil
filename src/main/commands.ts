import type { Engine } from '../core/engine/engine'

/** 화면 → 메인으로 보내는 명령 */
export type Command =
  | { t: 'set'; ids: string[]; attr: string; value: number }
  | { t: 'loadScene'; id: string }
  | { t: 'apply'; fade: number }
  | { t: 'cancel' }
  | { t: 'blackout'; on: boolean }
  | { t: 'master'; value: number }
  | { t: 'default' }

export function runCommand(e: Engine, c: Command, now: number) {
  switch (c.t) {
    case 'set': return e.setPreview(c.ids, c.attr, c.value)
    case 'loadScene': return e.loadSceneToPreview(c.id)
    case 'apply': return e.apply(now, c.fade)
    case 'cancel': return e.cancel()
    case 'blackout': e.blackout = c.on; return
    case 'master': e.master = Math.max(0, Math.min(1, c.value)); return
    case 'default': {
      // shortcut: 기본 조명 = 쇼 파일 default_scene, 없으면 첫 씬. 설정 화면에서 고르는 기능은 다음 단계
      const id = e.show.default_scene ?? e.show.scenes[0]?.id
      if (id) e.goScene(now, id)
      e.blackout = false
    }
  }
}
