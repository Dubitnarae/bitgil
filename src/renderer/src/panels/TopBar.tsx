import type { State } from '../api'
import { send } from '../api'

interface Props { st: State; view: 'live' | 'preview'; setView: (v: 'live' | 'preview') => void; onSettings: () => void; onPin: (m: 'unlock' | 'set') => void }

/** 상단: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE에 반영(안전 규칙의 예외) */
export function TopBar({ st, view, setView, onSettings, onPin }: Props) {
  return (
    <header className="topbar">
      <strong className="logo">빛길 <small className="dev">v{st.version} · 개발자 KIM YEONGDO</small>
        {st.update.text && <small className="update">{st.update.text}</small>}</strong>
      <button className={'blackout' + (st.blackout ? ' on' : '')} title="키보드 B" onClick={() => send({ t: 'blackout', on: !st.blackout })}>
        {st.blackout ? '블랙아웃 해제' : '블랙아웃'} <small>B</small>
      </button>
      <button title="키보드 H" onClick={() => send({ t: 'default' })}>기본 조명 <small>H</small></button>
      <label className="master">
        전체 밝기
        <input type="range" min={0} max={100} value={Math.round(st.master * 100)}
          onChange={(e) => send({ t: 'master', value: Number(e.target.value) / 100 })} />
        <span>{Math.round(st.master * 100)}%</span>
      </label>
      <div className="spacer" />
      <QualityPicker q={st.quality} />
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

const NAME = { low: '낮음', normal: '보통', high: '높음' } as const

/** 화면 품질: 운영 모드에서도 바로 바꿀 수 있고 지금 품질이 항상 보인다. 실제 조명 출력과는 상관없음 */
function QualityPicker({ q }: { q: State['quality'] }) {
  return (
    <label title={`3D 화면 선명도·갱신 횟수. 느리거나 팬 소리가 크면 낮음으로. 실제 조명 출력(초당 40번)은 그대로
이 컴퓨터: CPU ${q.cores}코어 · 메모리 ${q.memGB}GB`}>
      화면
      <select value={q.set} onChange={(e) => send({ t: 'quality', set: e.target.value as State['quality']['set'] })}>
        <option value="auto">자동 ({NAME[q.used]})</option>
        <option value="low">낮음</option>
        <option value="normal">보통</option>
        <option value="high">높음</option>
      </select>
    </label>
  )
}

/** 실제 장비 출력: 켜기/대기 버튼 + 상태. 켰는데 연결이 안 되면 빨갛게(2초마다 다시 연결 중) */
function OutputStatus({ o }: { o: State['output'] }) {
  const cls = !o.enabled ? 'status idle' : o.connected ? 'status' : 'status bad'
  const text = !o.enabled ? '출력 대기'
    : o.connected ? `출력 중 · ${o.port}`
    : '연결 안 됨'
  const tip = !o.enabled ? '장비로 보내지 않는 중입니다. [출력 켜기]를 누르면 실제 조명으로 나갑니다.'
    : o.connected ? `실제 조명 장비로 출력 중 (${o.port})`
    : `DMX 장비 연결이 끊겼습니다. 2초마다 다시 연결 중…${o.error ? ' — ' + o.error : ''}`
  return (
    <span className="outgroup">
      <button className={o.enabled ? 'on' : ''} onClick={() => send({ t: 'output', on: !o.enabled })}>
        {o.enabled ? '출력 끄기(대기)' : '출력 켜기'}
      </button>
      <span className={cls} title={tip}>{text}</span>
    </span>
  )
}
