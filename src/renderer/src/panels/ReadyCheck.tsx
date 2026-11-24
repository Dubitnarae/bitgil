import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { readyChecks } from '../ready'

const MARK = { ok: '✅', warn: '⚠', bad: '❌', info: 'ℹ' } as const

/** 예배 준비 점검 창: 열려 있는 동안 상태가 바뀌면 바로 다시 판단한다 */
export function ReadyCheck({ st, show, onClose }: { st: State; show: Show; onClose: () => void }) {
  const list = readyChecks(st, show)
  const bad = list.filter((c) => c.level === 'bad' || c.level === 'warn').length
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel ready" onClick={(e) => e.stopPropagation()}>
        <h3>예배 준비 점검</h3>
        <p className={bad ? 'warn' : 'hint'}>{bad ? `확인할 것 ${bad}개` : '모두 준비됐습니다.'}</p>
        <ul>
          {list.map((c) => <li key={c.name} className={c.level}><b>{MARK[c.level]} {c.name}</b><span>{c.text}</span></li>)}
        </ul>
        <div className="apply"><button className="go" autoFocus onClick={onClose}>닫기</button></div>
      </div>
    </div>
  )
}
