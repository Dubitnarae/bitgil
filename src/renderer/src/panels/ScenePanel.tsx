import { useState } from 'react'
import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'
import { SceneManager } from './SceneManager'

interface Props { show: Show; st: State; fade: number; setFade: (n: number) => void }

export function ScenePanel({ show, st, fade, setFade }: Props) {
  const [name, setName] = useState('')
  const [manage, setManage] = useState(false)
  const save = (temp: boolean) => { send({ t: 'saveScene', name, temp }); setName('') }
  return (
    <section className="panel">
      <h3>씬 <button className="close" onClick={() => setManage(!manage)}>{manage ? '관리 닫기' : '씬 관리'}</button></h3>
      <p className="hint">누르면 미리보기에서 그 씬 페이더가 100%, 나머지는 0이 됩니다. [적용]을 눌러야 실제 조명이 바뀝니다.</p>
      <div className="chips">
        {show.scenes.map((s) => (
          <button key={s.id} className={s.temp ? 'temp' : ''} title={s.temp ? '임시 씬' : s.id}
            onClick={() => { send({ t: 'selectScene', id: s.id }); setFade(s.fade_seconds) }}>
            {s.temp ? '임시 · ' : ''}{s.name}
          </button>
        ))}
      </div>
      <div className="apply">
        <button className="go" onClick={() => send({ t: 'apply', fade })}>적용</button>
        <label>
          페이드 <input type="number" min={0} max={60} step={0.5} value={fade} onChange={(e) => setFade(Number(e.target.value))} /> 초
        </label>
        <button onClick={() => send({ t: 'cancel' })}>취소</button>
      </div>
      {st.pending && <p className="warn">적용하지 않은 변경이 있습니다.</p>}

      <p className="hint">지금 미리보기 화면에 보이는 조명을 씬으로 저장합니다.</p>
      <div className="apply">
        <input className="name" placeholder="씬 이름 (예: 설교)" value={name} onChange={(e) => setName(e.target.value)} />
        {st.editMode && <button onClick={() => save(false)}>새 씬으로 저장</button>}
        <button onClick={() => save(true)}>임시 씬으로 저장</button>
      </div>
      {st.saveError && <p className="warn">{st.saveError}</p>}
      {!st.editMode && <p className="hint">운영 모드: 임시 씬만 저장·고칠 수 있습니다. 정식 씬은 [편집 모드]에서.</p>}
      {manage && <SceneManager show={show} edit={st.editMode} />}
    </section>
  )
}
