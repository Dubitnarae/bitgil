import { useEffect, useState } from 'react'
import type { Effect, Scene } from '../../../core/engine/types'
import { send } from '../api'

const TYPES: [Effect['type'], string][] = [['wave', '밝기 물결'], ['flash', '깜빡임'], ['color', '색 돌기'], ['circle', '무빙 원']]
// [속성, 이름, 최소, 최대, 단위]
const BARS: [keyof Effect & ('size' | 'speed' | 'repeat' | 'spread'), string, number, number, string][] = [
  ['size', '크기', 0, 100, '%'], ['speed', '속도', 0, 240, '번/분'], ['repeat', '반복', 1, 12, '번'], ['spread', '퍼짐', 0, 100, '%']
]

/**
 * 씬 효과 편집(편집 모드). 고치는 동안은 미리보기에만 보이고(effectDraft), [저장]해야 씬에 남는다.
 * 조명 순서 = 3D 에서 고른 순서 = 물결이 지나가는 순서.
 */
export function EffectEditor({ scene, selected, onClose }: { scene: Scene; selected: string[]; onClose: () => void }) {
  const [list, setList] = useState<Effect[]>(() => structuredClone(scene.effects ?? []))
  useEffect(() => { send({ t: 'selectScene', id: scene.id }) }, [scene.id]) // 미리보기에 이 씬을 올려야 효과가 보인다
  useEffect(() => { send({ t: 'effectDraft', id: scene.id, effects: list }) }, [scene.id, list])
  useEffect(() => () => send({ t: 'effectDraft', id: null }), [])

  const change = (i: number, p: Partial<Effect>) => setList(list.map((e, j) => (j === i ? { ...e, ...p } : e)))
  const add = () => {
    if (!selected.length) return alert('3D 화면에서 효과를 줄 조명을 먼저 고르세요 (Shift·Ctrl+클릭, 누른 순서 = 물결 순서)')
    setList([...list, { type: 'wave', fixtures: [...selected], size: 100, speed: 30, repeat: 1, spread: 100 }])
  }
  return (
    <div className="effect-editor">
      <h4>〰 '{scene.name}' 효과</h4>
      <p className="hint">고치는 동안 3D [미리보기]에만 보입니다. [저장]해야 씬에 남고, 그 씬이 켜지면 실제 조명에도 나갑니다.</p>
      {list.map((e, i) => (
        <div key={i} className="effect">
          <div className="row">
            <select value={e.type} onChange={(ev) => change(i, { type: ev.target.value as Effect['type'] })}>
              {TYPES.map(([t, label]) => <option key={t} value={t}>{label}</option>)}
            </select>
            <span className="hint" title={e.fixtures.join(', ')}>조명 {e.fixtures.length}개 ({e.fixtures.slice(0, 4).join(', ')}{e.fixtures.length > 4 ? '…' : ''})</span>
            <button disabled={!selected.length} onClick={() => change(i, { fixtures: [...selected] })} title="3D 에서 지금 고른 조명(고른 순서대로)으로 바꿉니다">선택한 조명으로</button>
            <button onClick={() => setList(list.filter((_, j) => j !== i))}>빼기</button>
          </div>
          {BARS.map(([k, label, min, max, unit]) => (
            <label key={k} className="row">
              <span className="bar-name">{label}</span>
              <input type="range" min={min} max={max} value={e[k]} onChange={(ev) => change(i, { [k]: Number(ev.target.value) })} />
              <span className="bar-val">{e[k]} {unit}</span>
            </label>
          ))}
        </div>
      ))}
      <div className="row">
        <button onClick={add}>＋ 효과 추가</button>
        <button className="go" onClick={() => { send({ t: 'setEffects', id: scene.id, effects: list }); onClose() }}>저장</button>
        <button onClick={onClose}>닫기 (저장 안 함)</button>
      </div>
    </div>
  )
}
