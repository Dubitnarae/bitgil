export type Box = { x: number; y: number; w: number; h: number; pri: number }

/** 겹치는 이름표 고르기: pri 큰 것부터 자리를 잡고, 이미 잡힌 자리와 겹치면 숨긴다. 결과 = 보일지 여부(입력 순서) */
export function keepLabels(boxes: Box[], pad = 6): boolean[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].pri - boxes[a].pri)
  const kept: Box[] = []
  const show = boxes.map(() => false)
  for (const i of order) {
    const a = boxes[i]
    if (kept.some((k) => a.x < k.x + k.w + pad && k.x < a.x + a.w + pad && a.y < k.y + k.h + pad && k.y < a.y + a.h + pad)) continue
    kept.push(a)
    show[i] = true
  }
  return show
}

/** 3D 화면 위 이름표(drei Html)를 재서 겹치는 것을 숨긴다. 선택·치수 이름표가 먼저, 나머지는 가까운 것(z-index 큼)이 먼저 */
export function declutter(root: Element) {
  const els = [...root.querySelectorAll<HTMLElement>('.label')]
  const boxes = els.map((el) => {
    const r = el.getBoundingClientRect()
    const z = Number((el.closest('[style*="z-index"]') as HTMLElement | null)?.style.zIndex) || 0
    const top = el.classList.contains('sel') || el.classList.contains('mark')
    return { x: r.x, y: r.y, w: r.width, h: r.height, pri: (top ? 1e9 : 0) + z }
  })
  keepLabels(boxes).forEach((s, i) => { els[i].style.visibility = s ? '' : 'hidden' })
}
