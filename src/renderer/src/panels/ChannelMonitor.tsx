import type { Show } from '../../../core/engine/types'

/** 채널 모니터: 지금 나가는 512채널 값. 선택한 조명의 채널은 노란 테두리. */
export function ChannelMonitor({ show, frame, selected }: { show: Show; frame: number[]; selected: string[] }) {
  const types = new Map(show.fixture_types.map((t) => [t.id, t]))
  const mine = new Set<number>()
  for (const f of show.fixtures) {
    if (!selected.includes(f.id)) continue
    const n = types.get(f.type)?.channel_count ?? 0
    for (let i = 0; i < n; i++) mine.add(f.address + i)
  }
  return (
    <div className="monitor">
      {frame.map((v, i) => (
        <div key={i} className={'ch' + (mine.has(i + 1) ? ' mine' : '')}
          style={{ background: `rgba(90,160,255,${v / 255})` }} title={`채널 ${i + 1}: ${v}`}>
          <small>{i + 1}</small>{v}
        </div>
      ))}
    </div>
  )
}
