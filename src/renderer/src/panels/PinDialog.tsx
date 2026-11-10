import { useState } from 'react'

/** 편집 모드 PIN 입력 창. 'unlock' = PIN 입력, 'set' = 처음 정하기, 'change' = 현재 PIN 확인 후 새 PIN, 'off' = 현재 PIN 확인 후 PIN 사용 끄기 */
export function PinDialog({ mode, onClose }: { mode: 'unlock' | 'set' | 'change' | 'off'; onClose: () => void }) {
  const [cur, setCur] = useState('')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false) // PIN 바꾸기 끝
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)
  const fresh = mode === 'set' || mode === 'change' // 새 PIN을 정하는 창

  const submit = async () => {
    if (pin.length !== 4) return setMsg('숫자 4자리를 넣어 주세요.')
    if (fresh) {
      if (pin !== again) return setMsg('새 PIN 두 번이 서로 다릅니다.')
      if (await window.bitgil.setPin(pin, cur)) return mode === 'change' ? setDone(true) : onClose()
      setCur('')
      return setMsg(mode === 'change' ? '현재 PIN이 맞지 않거나 편집 모드가 닫혔습니다.' : 'PIN을 저장하지 못했습니다.')
    }
    if (await (mode === 'off' ? window.bitgil.pinEnabled(false, pin) : window.bitgil.unlock(pin))) return onClose()
    setPin('')
    setMsg(mode === 'off' ? 'PIN이 맞지 않거나 편집 모드가 닫혔습니다.' : 'PIN이 맞지 않습니다.')
  }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }

  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h3>{{ set: '편집 모드 PIN 정하기', change: 'PIN 바꾸기', unlock: '편집 모드 열기', off: '편집 모드 PIN 끄기' }[mode]}</h3>
        <p className="hint">
          {mode === 'unlock' ? '편집 모드에서는 정식 씬 저장·삭제와 설정을 바꿀 수 있습니다. 10분 동안 조작이 없으면 저절로 닫힙니다.'
            : mode === 'off' ? '끄면 노트북과 폰 모두 PIN 없이 편집 모드가 열립니다(예배 중 실수로 설정이 바뀔 수 있음). 현재 PIN을 넣어 확인해 주세요.'
            : `${mode === 'change' ? '현재 PIN을 넣고, ' : ''}새 숫자 4자리를 두 번 넣어 주세요. 잊으면 설정 파일에서 지워야 하니 꼭 기억해 두세요.`}
        </p>
        {done ? <><p>PIN을 바꿨습니다. 다음부터 새 PIN으로 여세요.</p><div className="apply"><button className="go" autoFocus onClick={onClose}>닫기</button></div></> : <>
        {mode === 'change' && <input autoFocus type="password" inputMode="numeric" placeholder="현재 PIN" value={cur}
          onChange={(e) => setCur(digits(e.target.value))} onKeyDown={onKey} />}
        <input autoFocus={mode !== 'change'} type="password" inputMode="numeric" placeholder={mode === 'off' ? '현재 PIN' : fresh ? '새 PIN 4자리' : 'PIN 4자리'} value={pin}
          onChange={(e) => setPin(digits(e.target.value))} onKeyDown={onKey} />
        {fresh && <input type="password" inputMode="numeric" placeholder="한 번 더" value={again}
          onChange={(e) => setAgain(digits(e.target.value))} onKeyDown={onKey} />}
        {msg && <p className="warn">{msg}</p>}
        <div className="apply">
          <button className="go" onClick={submit}>확인</button>
          <button onClick={onClose}>닫기</button>
        </div>
        </>}
      </div>
    </div>
  )
}
