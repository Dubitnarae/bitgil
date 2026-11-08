import { useState } from 'react'
import type { State } from '../api'

/** 켤 때 새 버전을 찾으면 한 번 알려 준다: 무엇이 바뀌었는지 + 끌 때 설치된다는 안내 */
export function UpdateNotice({ st }: { st: State }) {
  const [closed, setClosed] = useState('')
  const n = st.update.notice
  if (!n || closed === n.version) return null
  const close = () => setClosed(n.version)
  return (
    // 화면을 덮지 않는 상자(블랙아웃은 언제든 한 번에 눌려야 하므로 뒤를 막지 않는다)
    <div className="notice">
      <div className="panel">
        <h3>새 버전이 있습니다</h3>
        <p>지금 <b>v{st.version}</b> → 새 버전 <b>v{n.version}</b></p>
        <p className="hint">바뀐 내용</p>
        <pre>{n.notes || '(설명 없음)'}</pre>
        <p className="hint">
          지금 뒤에서 받아 둡니다. <b>프로그램을 끄면 설치</b>되고, 다음에 켤 때 새 버전으로 열립니다.<br />
          조명 조작은 그대로 하셔도 되고, 예배 중에는 설치되지 않습니다.
        </p>
        <button onClick={close}>확인</button>
      </div>
    </div>
  )
}
