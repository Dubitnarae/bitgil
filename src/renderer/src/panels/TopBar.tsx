import type { State } from '../api'
import { send } from '../api'
import { useEffect, useRef, useState } from 'react'
import { smooth, soundFactor, startMic } from '../sound'

interface Props { st: State; view: 'live' | 'preview'; setView: (v: 'live' | 'preview') => void; onSettings: () => void; onPin: (m: 'unlock' | 'set') => void; onReady: () => void; onGuide: () => void }

/** 상단: 블랙아웃·기본 조명·전체 밝기는 바로 LIVE에 반영(안전 규칙의 예외) */
export function TopBar({ st, view, setView, onSettings, onPin, onReady, onGuide }: Props) {
  return (
    <header className="topbar">
      <strong className="logo">빛길 <small className="dev">v{st.version} · 개발자 KIM YEONGDO</small>
        {st.update.text && <small className="update">{st.update.text}</small>}</strong>
      <button data-guide="blackout" className={'blackout' + (st.blackout ? ' on' : '')} title="키보드 B" onClick={() => send({ t: 'blackout', on: !st.blackout })}>
        {st.blackout ? '블랙아웃 해제' : '블랙아웃'} <small>B</small>
      </button>
      <button data-guide="default" title="키보드 H" onClick={() => send({ t: 'default' })}>기본 조명 <small>H</small></button>
      <label className="master">
        전체 밝기
        <input type="range" min={0} max={100} value={Math.round(st.master * 100)}
          onChange={(e) => send({ t: 'master', value: Number(e.target.value) / 100 })} />
        <span>{Math.round(st.master * 100)}%</span>
      </label>
      <SoundControl sound={st.sound} />
      {/* 출력 상태는 앞쪽에: 창이 좁아 줄이 넘어가도 덜 중요한 오른쪽 것들이 아래로 간다 */}
      <OutputStatus o={st.output} />
      <button onClick={onReady} title="출력·쇼 파일·기본 조명·PIN·폰 원격을 한 번에 확인">예배 준비 점검</button>
      <button onClick={onGuide} title="처음 쓰는 사람용: 출력 켜기 → 기본 조명 → 순서 진행을 차례로 짚어 줌">따라하기</button>
      <div className="spacer" />
      <QualityPicker q={st.quality} />
      <div className="seg">
        <button className={view === 'preview' ? 'act' : ''} onClick={() => setView('preview')} title="3D 화면에 미리보기 값을 보여 줌">미리보기</button>
        <button className={view === 'live' ? 'act' : ''} onClick={() => setView('live')} title="3D 화면에 실제로 나가는 값을 보여 줌">실제 출력</button>
      </div>
      {st.fading && <span className="badge">페이드 중…</span>}
      {st.editMode
        ? <><button className="on" onClick={() => window.bitgil.lock()}>편집 모드 닫기</button><button onClick={onSettings}>설정</button></>
        : <button onClick={() => !st.pinEnabled ? window.bitgil.unlock('') : onPin(st.pinSet ? 'unlock' : 'set')}>편집 모드</button>}
      {!st.pinEnabled && <span className="badge" title="편집 모드가 PIN 없이 열립니다(노트북·폰 모두). 편집 모드 → 설정에서 다시 켤 수 있습니다.">⚠ PIN 꺼짐</span>}
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
      <button data-guide="output" className={o.enabled ? 'on' : ''} onClick={() => send({ t: 'output', on: !o.enabled })}>
        {o.enabled ? '출력 끄기(대기)' : '출력 켜기'}
      </button>
      <span className={cls} title={tip}>{text}</span>
    </span>
  )
}

const num = (k: string, d: number) => { const v = Number(localStorage.getItem(k)); return localStorage.getItem(k) !== null && Number.isFinite(v) ? v : d }

/**
 * 소리 반응(찬양용): 켜져 있는 동안 이 화면이 마이크를 열어 배율을 보낸다. 끄면 바로 전체 밝기 그대로.
 * 켜짐은 주황으로 깜빡여 눈에 띄게(설교 중 켜 둔 채 두지 않게). [기본 조명]을 눌러도 꺼진다.
 */
// shortcut: 노트북 창과 원격 전체 화면이 둘 다 켜면 두 마이크 값이 섞임, 문제되면 마이크 쪽 하나만 받게
function SoundControl({ sound }: { sound: number | null }) {
  const on = sound !== null
  const [floor, setFloor] = useState(() => num('bitgil-sound-floor', 40))
  const [sens, setSens] = useState(() => num('bitgil-sound-sens', 50))
  const cfg = useRef({ floor, sens })
  cfg.current = { floor, sens }
  useEffect(() => {
    if (!on) return
    let stop: (() => void) | null = null
    let dead = false
    let f = 1
    startMic((rms) => {
      f = smooth(f, soundFactor(rms, cfg.current.sens, cfg.current.floor / 100))
      send({ t: 'soundLevel', factor: f })
    }).then((s) => (dead ? s() : (stop = s)), (err) => {
      send({ t: 'sound', on: false })
      alert('마이크를 열 수 없어 소리 반응을 껐습니다.\n' + (err instanceof Error ? err.message : String(err)))
    })
    return () => { dead = true; stop?.() }
  }, [on])
  if (!on) return <button onClick={() => send({ t: 'sound', on: true })} title="찬양 때: 노트북 마이크 소리 크기에 따라 전체 밝기가 움직입니다(전체 밝기 막대가 가장 밝은 값)">소리 반응</button>
  const keep = (k: string, set: (v: number) => void) => (e: { target: { value: string } }) => { const v = Number(e.target.value); set(v); localStorage.setItem(k, String(v)) }
  return (
    <span className="sound on">
      <button onClick={() => send({ t: 'sound', on: false })} title="소리 반응 끄기(설교 전에 꼭 끄기, [기본 조명]으로도 꺼짐)">● 소리 반응 켜짐 — 끄기</button>
      <meter min={0} max={1} value={sound} title={`지금 밝기 배율 ${Math.round(sound * 100)}%`} />
      <label title="아무 소리가 없을 때 밝기(전체 밝기 대비)">최소 <input type="range" min={0} max={100} value={floor} onChange={keep('bitgil-sound-floor', setFloor)} />{floor}%</label>
      <label title="클수록 작은 소리에도 밝아짐">감도 <input type="range" min={0} max={100} value={sens} onChange={keep('bitgil-sound-sens', setSens)} /></label>
    </span>
  )
}
