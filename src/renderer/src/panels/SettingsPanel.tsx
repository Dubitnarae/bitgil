import type { State } from '../api'
import { send } from '../api'

export function SettingsPanel({ st, onClose }: { st: State; onClose: () => void }) {
  return (
    <section className="panel settings">
      <h3>설정 <button className="close" onClick={onClose}>닫기</button></h3>
      <p>씬 페이더를 움직이면</p>
      <label className="radio">
        <input type="radio" checked={st.faderMode === 'live'} onChange={() => send({ t: 'faderMode', mode: 'live' })} />
        바로 반영 — 움직이는 즉시 실제 조명이 따라온다 (콘솔과 같음)
      </label>
      <label className="radio">
        <input type="radio" checked={st.faderMode === 'preview'} onChange={() => send({ t: 'faderMode', mode: 'preview' })} />
        미리보기 후 반영 — 미리보기 화면에서 보고 [적용]을 눌러야 나간다
      </label>
    </section>
  )
}
