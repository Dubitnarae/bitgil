import type { Show } from '../../../core/engine/types'
import { send } from '../api'

/** 씬 이름 바꾸기·덮어쓰기·삭제. 바꿀 때마다 쇼 파일에 저장된다(백업 10개). */
/** 운영 모드(edit=false)에선 임시 씬만 고칠 수 있다 */
export function SceneManager({ show, edit }: { show: Show; edit: boolean }) {
  const rename = (id: string, old: string, name: string) => { if (name.trim() && name.trim() !== old) send({ t: 'renameScene', id, name }) }
  return (
    <div className="scene-manager">
      {show.scenes.filter((s) => edit || s.temp).map((s) => (
        <div key={s.id} className="row">
          <input className="name" defaultValue={s.name} key={s.name} title="이름을 고치고 Enter"
            onBlur={(e) => rename(s.id, s.name, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          {s.temp && <span className="badge">임시</span>}
          <button onClick={() => confirm(`'${s.name}' 씬을 지금 미리보기 화면 내용으로 덮어쓸까요?`) && send({ t: 'saveScene', name: s.name, id: s.id })}>덮어쓰기</button>
          <button onClick={() => confirm(`'${s.name}' 씬을 지울까요? (백업 폴더에는 남습니다)`) && send({ t: 'deleteScene', id: s.id })}>삭제</button>
        </div>
      ))}
    </div>
  )
}
