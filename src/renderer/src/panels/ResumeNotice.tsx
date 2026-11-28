import type { State } from '../api'
import { send } from '../api'

/** 빛길이 갑자기 꺼졌다 다시 켜졌을 때: 꺼지기 직전 조명 상태로 이어갈지 묻는다 */
export function ResumeNotice({ st }: { st: State }) {
  if (!st.resume) return null
  const when = new Date(st.resume.at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  return (
    // 화면을 덮지 않는 상자(블랙아웃은 언제든 한 번에 눌려야 하므로 뒤를 막지 않는다)
    <div className="notice">
      <div className="panel">
        <h3>빛길이 갑자기 꺼졌던 것 같습니다</h3>
        <p>꺼지기 직전(<b>{when}</b>) 조명 상태로 이어갈까요?</p>
        <p className="hint">
          이어가기 = 그때 켜져 있던 씬·밝기를 바로 되살립니다(자동 진행은 다시 눌러야 함).
          {!st.output.enabled && <> 지금 출력 대기 중이라 <b>[출력 켜기]</b>를 눌러야 실제 조명으로 나갑니다.</>}
        </p>
        <div className="apply">
          <button className="go" onClick={() => send({ t: 'resume', on: true })}>이어가기</button>
          <button onClick={() => send({ t: 'resume', on: false })}>처음 상태로</button>
        </div>
      </div>
    </div>
  )
}
