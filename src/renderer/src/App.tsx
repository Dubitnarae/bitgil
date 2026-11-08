import { useEffect, useState } from 'react'
import type { Show } from '../../core/engine/types'
import type { State } from './api'
import { Stage3D } from './3d/Stage3D'
import { TopBar } from './panels/TopBar'
import { FixturePanel } from './panels/FixturePanel'
import { ScenePanel } from './panels/ScenePanel'
import { ChannelMonitor } from './panels/ChannelMonitor'
import { FaderPanel } from './panels/FaderPanel'
import { SettingsPanel } from './panels/SettingsPanel'

export default function App() {
  const [show, setShow] = useState<Show | null>(null)
  const [st, setSt] = useState<State | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [view, setView] = useState<'live' | 'preview'>('preview')
  const [fade, setFade] = useState(2)
  const [monitor, setMonitor] = useState(false)
  const [settings, setSettings] = useState(false)

  useEffect(() => {
    window.bitgil.getShow().then(setShow)
    const off = window.bitgil.onState(setSt)
    const offShow = window.bitgil.onShow(setShow) // 씬 저장·이름 바꾸기 뒤 새 쇼
    window.bitgil.getState().then((s) => setSt((cur) => cur ?? s)) // 처음 상태(이미 받았으면 그대로)
    return () => { off(); offShow() }
  }, [])

  if (!show || !st) return <div className="loading">불러오는 중…</div>

  const onSelect = (id: string, add: boolean) =>
    setSelected((s) => (add ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))
  // 미리보기 화면은 전체 밝기·블랙아웃을 빼고 편집 값(+미리보기 페이더)만 보여준다
  const values = view === 'live' ? st.live : st.previewOut
  const master = view === 'live' ? (st.blackout ? 0 : st.master) : 1

  return (
    <div className="app">
      <TopBar st={st} view={view} setView={setView} onSettings={() => setSettings(!settings)} />
      <main>
        <div className={'view ' + view}>
          <Stage3D show={show} values={values} master={master} selected={selected}
            onSelect={onSelect} onClear={() => setSelected([])} />
          <span className="viewtag">{view === 'live' ? '실제 출력' : '미리보기'}</span>
        </div>
        <aside>
          {settings && <SettingsPanel st={st} onClose={() => setSettings(false)} />}
          <ScenePanel show={show} st={st} fade={fade} setFade={setFade} />
          <FixturePanel show={show} st={st} selected={selected} setSelected={setSelected} />
        </aside>
      </main>
      <footer>
        <FaderPanel show={show} st={st} />
        <button onClick={() => setMonitor(!monitor)}>{monitor ? '채널 모니터 닫기' : '채널 모니터 열기'}</button>
        {monitor && <ChannelMonitor show={show} frame={st.frame} selected={selected} />}
      </footer>
    </div>
  )
}
