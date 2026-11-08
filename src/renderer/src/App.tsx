import { useEffect, useState } from 'react'
import type { Show } from '../../core/engine/types'
import type { State } from './api'
import { Stage3D } from './3d/Stage3D'
import { TopBar } from './panels/TopBar'
import { FixturePanel } from './panels/FixturePanel'
import { ScenePanel } from './panels/ScenePanel'
import { ChannelMonitor } from './panels/ChannelMonitor'

export default function App() {
  const [show, setShow] = useState<Show | null>(null)
  const [st, setSt] = useState<State | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [view, setView] = useState<'live' | 'preview'>('preview')
  const [fade, setFade] = useState(2)
  const [monitor, setMonitor] = useState(false)

  useEffect(() => {
    window.bitgil.getShow().then(setShow)
    return window.bitgil.onState(setSt)
  }, [])

  if (!show || !st) return <div className="loading">불러오는 중…</div>

  const onSelect = (id: string, add: boolean) =>
    setSelected((s) => (add ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))
  // 미리보기 화면은 전체 밝기·블랙아웃을 빼고 편집 값만 보여준다
  const values = view === 'live' ? st.live : st.preview
  const master = view === 'live' ? (st.blackout ? 0 : st.master) : 1

  return (
    <div className="app">
      <TopBar st={st} view={view} setView={setView} />
      <main>
        <div className={'view ' + view}>
          <Stage3D show={show} values={values} master={master} selected={selected}
            onSelect={onSelect} onClear={() => setSelected([])} />
          <span className="viewtag">{view === 'live' ? '실제 출력' : '미리보기'}</span>
        </div>
        <aside>
          <ScenePanel show={show} st={st} fade={fade} setFade={setFade} />
          <FixturePanel show={show} st={st} selected={selected} setSelected={setSelected} />
        </aside>
      </main>
      <footer>
        <button onClick={() => setMonitor(!monitor)}>{monitor ? '채널 모니터 닫기' : '채널 모니터 열기'}</button>
        {monitor && <ChannelMonitor show={show} frame={st.frame} selected={selected} />}
      </footer>
    </div>
  )
}
