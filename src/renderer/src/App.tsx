import { useEffect, useRef, useState } from 'react'
import type { Show } from '../../core/engine/types'
import { send, type State } from './api'
import { Stage3D } from './3d/Stage3D'
import { TopBar } from './panels/TopBar'
import { FixturePanel } from './panels/FixturePanel'
import { ScenePanel } from './panels/ScenePanel'
import { CuePanel } from './panels/CuePanel'
import { ChannelMonitor } from './panels/ChannelMonitor'
import { FaderPanel } from './panels/FaderPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { PinDialog } from './panels/PinDialog'
import { UpdateNotice } from './panels/UpdateNotice'
import { ChannelTest, FindPanel } from './panels/FindPanel'
import { VenuePanel } from './panels/VenuePanel'
import { aimAt, withDrafts, type Aim } from './aim'

/** 폰에서 버튼을 누르면 5초 동안 화면 위쪽 가운데에 알림 */
function PhoneNote({ note }: { note: State['phone'] }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!note.at || Date.now() - note.at > 5000) return
    setOn(true)
    const t = setTimeout(() => setOn(false), 5000)
    return () => clearTimeout(t)
  }, [note.at])
  return on ? <div className="phone-note">📱 폰에서 누름: <b>{note.text}</b></div> : null
}

export default function App() {
  const [show, setShow] = useState<Show | null>(null)
  const [st, setSt] = useState<State | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [view, setView] = useState<'live' | 'preview'>('preview')
  const [fade, setFade] = useState(2)
  const [monitor, setMonitor] = useState(false)
  const [settings, setSettings] = useState(false)
  const [pin, setPin] = useState<'unlock' | 'set' | 'change' | 'off' | null>(null)
  const [aim, setAim] = useState<Aim | null>(null) // null = 빛 위치 찍기 꺼짐

  useEffect(() => {
    window.bitgil.getShow().then(setShow)
    const off = window.bitgil.onState(setSt)
    const offShow = window.bitgil.onShow(setShow) // 씬 저장·이름 바꾸기 뒤 새 쇼
    window.bitgil.getState().then((s) => setSt((cur) => cur ?? s)) // 처음 상태(이미 받았으면 그대로)
    return () => { off(); offShow() }
  }, [])

  // 비상 단축키: B = 블랙아웃 켜기/끄기, H = 기본 조명. 글자 입력 칸에서는 안 먹음. 한글 자판이어도 되게 e.code 로 본다.
  const stRef = useRef(st)
  stRef.current = st
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
        (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type))
      if (typing || e.repeat || e.ctrlKey || e.altKey || e.metaKey || !stRef.current) return
      if (e.code === 'KeyB') send({ t: 'blackout', on: !stRef.current.blackout })
      else if (e.code === 'KeyH') send({ t: 'default' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!show || !st) return <div className="loading">불러오는 중…</div>

  // 조명 찾기 중: 3D는 실제 출력 화면, 조명을 누르면 그 조명을 켠다
  const finding = st.find !== null
  const onSelect = (id: string, add: boolean) => finding ? send({ t: 'find', id }) :
    setSelected((s) => (add ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))
  const shown = finding ? 'live' : view
  // 미리보기 화면은 전체 밝기·블랙아웃을 빼고 편집 값(+미리보기 페이더)만 보여준다
  const values = shown === 'live' ? st.live : st.previewOut
  const master = shown === 'live' ? (st.blackout ? 0 : finding ? 1 : st.master) : 1
  const pointing = aim !== null && selected.length > 0

  return (
    <div className="app">
      <TopBar st={st} view={view} setView={setView} onSettings={() => setSettings(!settings)} onPin={setPin} />
      <main>
        <div className={'view ' + shown + (pointing ? ' pointing' : '')}>
          <Stage3D show={aim ? withDrafts(show, aim.drafts) : show} values={values} master={master} selected={finding ? [st.find!] : selected}
            onSelect={onSelect} onClear={() => setSelected([])} quality={st.quality.used}
            onPoint={pointing ? (p) => setAim(aimAt(show, st, selected, p, aim!)) : undefined} />
          <span className="viewtag">{st.chTest ? `실제 출력 · 채널 ${st.chTest.ch} 시험 중 (3D는 채널 시험을 안 보여 줌)` : finding ? '실제 출력 · 조명 찾기 중' : shown === 'live' ? '실제 출력' : '미리보기'}</span>
        </div>
        <aside>
          {/* 설정은 편집 모드에서만(10분 지나 닫히면 같이 사라진다) */}
          {settings && st.editMode && <SettingsPanel show={show} st={st} onClose={() => setSettings(false)} onPin={setPin} />}
          {st.editMode && <FindPanel show={show} st={st} selected={selected} />}
          {st.editMode && !st.find && <ChannelTest st={st} />}
          {st.editMode && <VenuePanel show={show} />}
          <ScenePanel show={show} st={st} fade={fade} setFade={setFade} />
          <CuePanel show={show} st={st} setFade={setFade} />
          <FixturePanel show={show} st={st} selected={selected} setSelected={setSelected} aim={aim} setAim={setAim} />
        </aside>
      </main>
      <footer>
        <FaderPanel show={show} st={st} />
        <button onClick={() => setMonitor(!monitor)}>{monitor ? '채널 모니터 닫기' : '채널 모니터 열기'}</button>
        {monitor && <ChannelMonitor show={show} frame={st.frame} selected={selected} />}
      </footer>
      {pin && <PinDialog mode={pin} onClose={() => setPin(null)} />}
      <UpdateNotice st={st} />
      <PhoneNote note={st.phone} />
    </div>
  )
}
