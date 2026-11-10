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

export function SettingsPanel({ show, st, onClose, onPin }: { show: import('../../../core/engine/types').Show; st: State; onClose: () => void; onPin: (m: 'set' | 'change' | 'off') => void }) {
  const [ports, setPorts] = useState<{ path: string; manufacturer?: string }[]>([])
  const refresh = () => window.bitgil.listPorts().then(setPorts, () => setPorts([]))
  useEffect(() => { refresh() }, [])
  const [xhdMsg, setXhdMsg] = useState('')
  const [showMsg, setShowMsg] = useState('')
  return (
    <section className="panel settings">
      <h3>설정 <button className="close" onClick={onClose}>닫기</button></h3>
      <div className="group">
      <h4>씬 페이더</h4>
      <p className="hint">페이더를 움직이면</p>
      <label className="radio">
        <input type="radio" checked={st.faderMode === 'live'} onChange={() => send({ t: 'faderMode', mode: 'live' })} />
        바로 반영 — 움직이는 즉시 실제 조명이 따라온다 (콘솔과 같음)
      </label>
      <label className="radio">
        <input type="radio" checked={st.faderMode === 'preview'} onChange={() => send({ t: 'faderMode', mode: 'preview' })} />
        미리보기 후 반영 — 미리보기 화면에서 보고 [적용]을 눌러야 나간다
      </label>

      </div>

      <div className="group">
      <h4>기본 조명</h4>
      <p className="hint">[기본 조명] 버튼·키보드 H·폰 원격 [기본 조명]을 누르면 바로 켜질 씬 (블랙아웃도 풀림)</p>
      <label className="radio">
        <select value={show.default_scene ?? ''} onChange={(e) => send({ t: 'defaultScene', id: e.target.value })}>
          {!show.default_scene && <option value="">아직 안 정함 — 지금은 첫 씬 ({show.scenes[0]?.name ?? '없음'})</option>}
          {show.scenes.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}
        </select>
      </label>
      </div>

      <div className="group">
      <h4>DMX 출력 (USB 인터페이스)</h4>
      <p className="hint">인터페이스 종류</p>
      <label className="radio">
        <input type="radio" checked={st.output.type === 'pro'} onChange={() => send({ t: 'dmxType', type: 'pro' })} />
        Enttec DMX USB Pro 호환 (DMXking ultraDMX 등)
      </label>
      <label className="radio">
        <input type="radio" checked={st.output.type === 'open'} onChange={() => send({ t: 'dmxType', type: 'open' })} />
        Open DMX 호환 (Lixada USB-DMX512 등 FTDI 칩 제품)
      </label>
      <p className="hint">포트</p>
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
      </div>

      <div className="group">
      <h4>폰 원격 (같은 Wi-Fi)</h4>
      <label className="radio">
        <input type="checkbox" checked={st.remote.on} onChange={(e) => send({ t: 'remote', on: e.target.checked })} />
        켜기 — 폰에서 상태 보기, [다음 씬]·[기본 조명]·[블랙아웃]
      </label>
      {st.remote.on && <p className="hint">
        폰 카메라로 찍으면 바로 연결됩니다(코드 입력 필요 없음)
        {st.remote.urls.map((u) => <RemoteQr key={u} url={`${u}/?code=${st.remote.code}`} />)}
        직접 넣을 때 주소: {st.remote.urls.join('  또는  ') || '(Wi-Fi 연결 없음)'}<br />
        원격 접속 코드: <b>{st.remote.code}</b>{' '}
        <button onClick={() => confirm('원격 접속 코드를 새로 만들까요?\n지금 연결된 폰은 끊기고, 새 코드(QR)로 다시 연결해야 합니다.') && send({ t: 'remoteNewCode' })}>코드 새로 만들기</button>
        {' '}· 지금 연결된 폰 {st.remote.clients}대
        {st.remote.error && <><br /><span style={{ color: '#ff6b6b' }}>{st.remote.error}</span></>}
      </p>}
      </div>

      <div className="group">
      <h4>업데이트</h4>
      <p className="hint">지금 버전: <b>v{st.version}</b> · 마지막 확인: {st.update.lastCheck || '아직 없음'}{' '}
        <button onClick={() => send({ t: 'checkUpdate' })}>지금 확인</button>{st.update.text && <> · <b>{st.update.text}</b></>}</p>
      <label className="radio">
        <input type="checkbox" checked={st.update.on} onChange={(e) => send({ t: 'autoUpdate', on: e.target.checked })} />
        업데이트 확인 — 하루 한 번 새 버전을 확인해 알려 줌. 설치할지는 그때 고름 (설치는 프로그램을 끌 때, 예배 중에는 안 함)
      </label>
      </div>

      <div className="group">
      <h4>쇼 파일 옮기기 (다른 컴퓨터 ↔ USB)</h4>
      <p className="hint">씬·순서 목록·조명 위치가 모두 들어 있는 파일. 집 컴퓨터에서 고친 쇼를 교회 노트북으로 옮길 때 씁니다</p>
      <button onClick={() => window.bitgil.showExport().then(setShowMsg)}>쇼 파일 내보내기</button>{' '}
      <button onClick={() => confirm('쇼 파일을 가져올까요?\n지금 쇼는 백업 폴더에 남고, 빛길이 다시 켜집니다(출력은 설정대로 다시 시작).\n예배 중에는 하지 마세요.') && window.bitgil.showImport().then(setShowMsg)}>쇼 파일 가져오기</button>
      {showMsg && <p className="hint"><b>{showMsg}</b></p>}
      </div>

      <div className="group">
      <h4>기존 콘솔 (Mini Pearl 1024 Pro) 백업 파일</h4>
      <p className="hint">콘솔에서 USB로 저장한 .XHD 파일. 씬 번호는 콘솔 자리 그대로 P페이지-페이더 (예: P1-03)</p>
      <button onClick={() => confirm('콘솔 백업의 씬을 불러올까요?\n같은 번호(P1-01 등) 씬은 콘솔 값으로 바뀌고, 지금 쇼는 백업 폴더에 남습니다.') && window.bitgil.xhdImport().then(setXhdMsg)}>콘솔 백업에서 씬 불러오기</button>{' '}
      <button onClick={() => window.bitgil.xhdExport().then(setXhdMsg)}>콘솔 백업 파일로 내보내기</button>
      <p className="hint">내보내기: 원본 백업을 고르면 그 복사본에 빛길 씬 값을 써 넣어 새 파일로 저장합니다(원본은 그대로).
        콘솔에 이미 기록된 자리만 쓸 수 있어, 새 자리에 넣으려면 콘솔에서 그 페이더에 아무 장면이나 먼저 기록하고 백업하세요.
        콘솔에 넣어 보는 시험은 예배가 없는 날에, 원본 백업을 꼭 따로 두고 하세요.</p>
      {xhdMsg && <p className="hint"><b>{xhdMsg}</b></p>}
      </div>

      <div className="group">
      <h4>편집 모드 PIN</h4>
      <label className="radio">
        <input type="checkbox" checked={st.pinEnabled}
          onChange={(e) => { if (!e.target.checked) onPin('off'); else if (st.pinSet) window.bitgil.pinEnabled(true); else onPin('set') }} />
        편집 모드 PIN 사용 — 끄면 노트북과 폰 모두 PIN 없이 편집 모드가 열림 (폰 접속 코드는 그대로 필요, 끌 때 현재 PIN 확인)
      </label>
      <button onClick={() => onPin('change')}>PIN 바꾸기</button>
      </div>
      <p className="hint">빛길 v{st.version} · 개발자 KIM YEONGDO</p>
    </section>
  )
}
