import type { State } from '../api'
import { send } from '../api'

interface Props { st: State; view: 'live' | 'preview'; setView: (v: 'live' | 'preview') => void }

/** 상단: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE에 반영(안전 규칙의 예외) */
export function TopBar({ st, view, setView }: Props) {
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
      <span className={'status' + (st.output.connected ? '' : ' bad')}>
        {st.output.name}{st.output.connected ? ' · 연결됨' : ' · 연결 끊김'}
      </span>
    </header>
  )
}
