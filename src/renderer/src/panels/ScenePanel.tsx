import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { send } from '../api'

interface Props { show: Show; st: State; fade: number; setFade: (n: number) => void }

export function ScenePanel({ show, st, fade, setFade }: Props) {
  return (
    <section className="panel">
      <h3>씬</h3>
      <p className="hint">누르면 미리보기에만 불러옵니다. [적용]을 눌러야 실제 조명이 바뀝니다.</p>
      <div className="chips">
        {show.scenes.map((s) => (
          <button key={s.id} onClick={() => { send({ t: 'loadScene', id: s.id }); setFade(s.fade_seconds) }}>{s.name}</button>
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
    </section>
  )
}
