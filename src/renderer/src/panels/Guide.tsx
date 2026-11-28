import { useEffect } from 'react'
import type { Show } from '../../../core/engine/types'
import type { State } from '../api'
import { guideSteps } from '../guide'

/** 처음 쓰는 사람용 따라하기: 지금 할 단계의 버튼을 깜빡여 짚어 준다. 버튼은 원래 버튼을 그대로 누른다 */
export function Guide({ st, show, onClose }: { st: State; show: Show; onClose: () => void }) {
  const steps = guideSteps(st, show)
  const now = steps.findIndex((s) => !s.done)
  const target = now >= 0 ? steps[now].target : ''
  // 의존 목록 없음: 버튼이 다시 그려지면 React 가 class 를 덮어써서 그릴 때마다 다시 붙인다
  useEffect(() => {
    const els = document.querySelectorAll(`[data-guide="${target}"]`)
    els.forEach((e) => e.classList.add('guide-hl'))
    return () => els.forEach((e) => e.classList.remove('guide-hl'))
  })
  return (
    <div className="guide panel">
      <h3>따라하기 <button className="close" onClick={onClose}>닫기</button></h3>
      <ol>
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'done' : i === now ? 'now' : ''}>
            <b>{s.done ? '✓' : i + 1}. {s.title}</b>
            {i === now && <p>{s.text}</p>}
          </li>
        ))}
      </ol>
      {now < 0 && <p className="ok">다 됐습니다! 예배 중에는 순서 목록 [다음 ▶] → [적용]을 반복하면 됩니다. 문제가 생기면 [기본 조명](H) 또는 [블랙아웃](B).</p>}
      <p className="hint">깜빡이는 버튼을 누르세요. 위쪽 [따라하기]로 언제든 다시 열 수 있습니다.</p>
    </div>
  )
}
