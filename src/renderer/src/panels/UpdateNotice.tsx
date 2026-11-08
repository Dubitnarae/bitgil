import type { State } from '../api'
import { send } from '../api'

/** 켤 때 새 버전을 찾으면 묻는다: 무엇이 바뀌었는지 보여 주고 설치·나중에·건너뛰기 중 고르게 한다 */
export function UpdateNotice({ st }: { st: State }) {
  const n = st.update.notice
  if (!n) return null
  const choose = (choice: 'install' | 'later' | 'skip') => send({ t: 'updateChoice', choice })
  return (
    // 화면을 덮지 않는 상자(블랙아웃은 언제든 한 번에 눌려야 하므로 뒤를 막지 않는다)
    <div className="notice">
      <div className="panel">
        <h3>새 버전이 있습니다</h3>
        <p>지금 <b>v{st.version}</b> → 새 버전 <b>v{n.version}</b></p>
        <p className="hint">바뀐 내용</p>
        <pre>{n.notes || '(설명 없음)'}</pre>
        <p className="hint">
          설치를 고르면 뒤에서 받아 두었다가 <b>프로그램을 끌 때 설치</b>합니다. 예배 중에는 설치되지 않습니다.
        </p>
        <div className="apply">
          <button className="go" onClick={() => choose('install')}>받아 두고 끌 때 설치</button>
          <button onClick={() => choose('later')}>나중에</button>
          <button onClick={() => choose('skip')}>이 버전 건너뛰기</button>
        </div>
        <p className="hint">나중에 = 내일 다시 알림 · 건너뛰기 = 이 버전은 다시 안 알림(더 새 버전이 나오면 알림)</p>
      </div>
    </div>
  )
}
