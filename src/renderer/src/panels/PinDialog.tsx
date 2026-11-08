import { useState } from 'react'

/** 편집 모드 PIN 입력 창. 'unlock' = PIN 입력, 'set' = 새 PIN 두 번 입력 */
export function PinDialog({ mode, onClose }: { mode: 'unlock' | 'set'; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  const submit = async () => {
    if (pin.length !== 4) return setMsg('숫자 4자리를 넣어 주세요.')
    if (mode === 'set') {
      if (pin !== again) return setMsg('두 번 넣은 PIN이 다릅니다.')
      if (await window.bitgil.setPin(pin)) return onClose()
      return setMsg('PIN을 저장하지 못했습니다.')
    }
    if (await window.bitgil.unlock(pin)) return onClose()
    setPin('')
    setMsg('PIN이 맞지 않습니다.')
  }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }

  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'set' ? '편집 모드 PIN 정하기' : '편집 모드 열기'}</h3>
        <p className="hint">
          {mode === 'set' ? '숫자 4자리를 두 번 넣어 주세요. 잊으면 설정 파일에서 지워야 하니 꼭 기억해 두세요.'
            : '편집 모드에서는 정식 씬 저장·삭제와 설정을 바꿀 수 있습니다. 10분 동안 조작이 없으면 저절로 닫힙니다.'}
        </p>
        <input autoFocus type="password" inputMode="numeric" placeholder="PIN 4자리" value={pin}
          onChange={(e) => setPin(digits(e.target.value))} onKeyDown={onKey} />
        {mode === 'set' && <input type="password" inputMode="numeric" placeholder="한 번 더" value={again}
          onChange={(e) => setAgain(digits(e.target.value))} onKeyDown={onKey} />}
        {msg && <p className="warn">{msg}</p>}
        <div className="apply">
          <button className="go" onClick={submit}>확인</button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
