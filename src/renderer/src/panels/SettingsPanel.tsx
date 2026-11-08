import { useEffect, useState } from 'react'
import type { State } from '../api'
import { send } from '../api'
import QRCode from 'qrcode'

/** 폰으로 찍으면 접속 코드까지 넣어 바로 연결되는 QR */
function RemoteQr({ url }: { url: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { width: 180, margin: 1 }).then(setSrc, () => setSrc('')) }, [url])
  return src ? <img src={src} alt="폰 원격 QR" width={180} height={180} style={{ display: 'block', margin: '6px 0' }} /> : null
}

export function SettingsPanel({ st, onClose, onChangePin }: { st: State; onClose: () => void; onChangePin: () => void }) {
  const [ports, setPorts] = useState<{ path: string; manufacturer?: string }[]>([])
  const refresh = () => window.bitgil.listPorts().then(setPorts, () => setPorts([]))
  useEffect(() => { refresh() }, [])
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

      <p>DMX 인터페이스 포트</p>
      <label className="radio">
        <select value={st.output.preferred} onChange={(e) => send({ t: 'dmxPort', path: e.target.value })}>
          <option value="">자동 찾기 (FTDI·ENTTEC·DMXking)</option>
          {ports.map((p) => <option key={p.path} value={p.path}>{p.path}{p.manufacturer ? ` — ${p.manufacturer}` : ''}</option>)}
          {st.output.preferred && !ports.some((p) => p.path === st.output.preferred) &&
            <option value={st.output.preferred}>{st.output.preferred} (지금 없음)</option>}
        </select>
        <button onClick={refresh}>다시 찾기</button>
      </label>
      <label className="radio">
        <input type="checkbox" checked={st.output.onStart} onChange={(e) => send({ t: 'outputOnStart', on: e.target.checked })} />
        프로그램을 켜면 바로 장비로 출력 (끄면 '출력 대기'로 시작 — 권장)
      </label>
      <p>폰 원격 (같은 Wi-Fi)</p>
      <label className="radio">
        <input type="checkbox" checked={st.remote.on} onChange={(e) => send({ t: 'remote', on: e.target.checked })} />
        켜기 — 폰에서 상태 보기, [다음 씬]·[기본 조명]·[블랙아웃]
      </label>
      {st.remote.on && <p className="hint">
        폰 카메라로 찍으면 바로 연결됩니다(코드 입력 필요 없음)
        {st.remote.urls.map((u) => <RemoteQr key={u} url={`${u}/?code=${st.remote.code}`} />)}
        직접 넣을 때 주소: {st.remote.urls.join('  또는  ') || '(Wi-Fi 연결 없음)'}<br />
        원격 접속 코드: <b>{st.remote.code}</b> · 지금 연결된 폰 {st.remote.clients}대
        {st.remote.error && <><br /><span style={{ color: '#ff6b6b' }}>{st.remote.error}</span></>}
      </p>}
      <p>편집 모드 PIN <button onClick={onChangePin}>PIN 바꾸기</button></p>
      <p className="hint">빛길 · 개발자 KIM YEONGDO</p>
    </section>
  )
}
