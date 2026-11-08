import type { State } from '../api'
import { send } from '../api'

interface Props { st: State; view: 'live' | 'preview'; setView: (v: 'live' | 'preview') => void; onSettings: () => void; onPin: (m: 'unlock' | 'set') => void }

/** 상단: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE에 반영(안전 규칙의 예외) */
export function TopBar({ st, view, setView, onSettings, onPin }: Props) {
  return (
    <header className="topbar">
      <strong className="logo">빛길</strong>
      <button className={'blackout' + (st.blackout ? ' on' : '')} onClick={() => send({ t: 'blackout', on: !st.blackout })}>
        {st.blackout ? '블랙아웃 해제' : '블랙아웃'}
      </button>
      <button onClick={() => send({ t: 'default' })}>기본 조명</button>
      <label className="master">
        전체 밝기
        <input type="range" min={0} max={100} value={Math.round(st.master * 100)}
          onChange={(e) => send({ t: 'master', value: Number(e.target.value) / 100 })} />
        <span>{Math.round(st.master * 100)}%</span>
      </label>
      <div className="spacer" />
      <div className="seg">
        <button className={view === 'preview' ? 'act' : ''} onClick={() => setView('preview')}>미리보기 화면</button>
        <button className={view === 'live' ? 'act' : ''} onClick={() => setView('live')}>실제 출력 화면</button>
      </div>
      {st.fading && <span className="badge">페이드 중…</span>}
      {st.editMode
        ? <><button className="on" onClick={() => window.bitgil.lock()}>편집 모드 닫기</button><button onClick={onSettings}>설정</button></>
        : <button onClick={() => onPin(st.pinSet ? 'unlock' : 'set')}>편집 모드</button>}
      <OutputStatus o={st.output} />
    </header>
  )
}

/** 실제 장비 출력: 켜기/대기 버튼 + 상태. 켰는데 연결이 안 되면 빨갛게(2초마다 다시 연결 중) */
function OutputStatus({ o }: { o: State['output'] }) {
  const cls = !o.enabled ? 'status idle' : o.connected ? 'status' : 'status bad'
  const text = !o.enabled ? '출력 대기 (장비로 안 보냄)'
    : o.connected ? `장비 출력 중 · ${o.port}`
    : '연결 안 됨 · 다시 연결 중…'
  return (
    <>
      <button className={o.enabled ? 'on' : ''} onClick={() => send({ t: 'output', on: !o.enabled })}>
        {o.enabled ? '출력 끄기(대기)' : '출력 켜기'}
      </button>
      <span className={cls} title={o.error}>{text}</span>
    </>
  )
}
