import type { Show } from '../../../core/engine/types'
import { useState } from 'react'
import { send } from '../api'
import { EffectEditor } from './EffectEditor'

/** 씬 이름 바꾸기·덮어쓰기·삭제. 바꿀 때마다 쇼 파일에 저장된다(백업 10개). */
/** 운영 모드(edit=false)에선 임시 씬만 고칠 수 있다 */
export function SceneManager({ show, edit, selected }: { show: Show; edit: boolean; selected: string[] }) {
  const [fx, setFx] = useState<string | null>(null) // 효과 편집 중인 씬
  const fxScene = show.scenes.find((s) => s.id === fx)
  const rename = (id: string, old: string, name: string) => { if (name.trim() && name.trim() !== old) send({ t: 'renameScene', id, name }) }
  return (
    <>
    <div className="scene-manager">
      {show.scenes.filter((s) => edit || s.temp).map((s) => (
        <div key={s.id} className="row">
          <input className="name" defaultValue={s.name} key={s.name} title="이름을 고치고 Enter"
            onBlur={(e) => rename(s.id, s.name, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          {s.temp && <span className="badge">임시</span>}
          <button onClick={() => confirm(`'${s.name}' 씬을 지금 미리보기 화면 내용으로 덮어쓸까요?`) && send({ t: 'saveScene', name: s.name, id: s.id })}>덮어쓰기</button>
          {edit && <button className={fx === s.id ? 'on' : ''} onClick={() => setFx(fx === s.id ? null : s.id)} title="이 씬에 효과(밝기 물결·깜빡임·색 돌기·무빙 원) 넣기">〰 효과{s.effects?.length ? ` ${s.effects.length}` : ''}</button>}
          <button onClick={() => confirm(`'${s.name}' 씬을 지울까요? (백업 폴더에는 남습니다)`) && send({ t: 'deleteScene', id: s.id })}>삭제</button>
        </div>
      ))}
    </div>
    {edit && fxScene && <EffectEditor key={fxScene.id} scene={fxScene} selected={selected} onClose={() => setFx(null)} />}
    </>
  )
}
