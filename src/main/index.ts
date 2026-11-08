import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { Engine } from '../core/engine/engine'
import { VirtualOutput } from './dmx/output'
import { EnttecProOutput, listPorts } from './dmx/enttec'
import { runCommand, type Command } from './commands'
import { loadSettings, saveSettings } from './settings'
import { loadShowFile, saveShowFile } from './showfile'
import { allowedInOperation, checkPin, EditMode, hashPin, isPin } from './editmode'
import { randomInt } from 'node:crypto'
import { lanUrls, startRemote, type PhoneCmd, type PhoneState } from './remote/server'
import { startUpdater, update } from './updater'

// 사용자 쇼 파일은 문서\빛길\show.bitgil.json (없으면 시작 데이터로 시작, 처음 바뀔 때 저장)
const showDir = join(app.getPath('documents'), '빛길')
const engine = new Engine(loadShowFile(showDir, join(app.getAppPath(), 'data/starter-show.bitgil.json')))
let saveError = ''

/** 쇼(씬 목록)가 바뀌면 파일에 저장하고 화면에 새 쇼를 보낸다 */
function showChanged() {
  try {
    saveShowFile(showDir, engine.show)
    saveError = ''
  } catch (err) {
    saveError = `쇼 파일을 저장하지 못했습니다: ${err instanceof Error ? err.message : err}`
    console.error(err)
  }
  win?.webContents.send('show', engine.show)
}
const output = new VirtualOutput() // 채널 모니터용, 항상 마지막 프레임을 기억
const settings = loadSettings()
engine.faderMode = settings.faderMode
// 시작 기본은 '출력 대기'(장비로 안 보냄). 설정에서 '시작할 때 바로 출력'을 켰을 때만 바로 내보낸다.
const enttec = new EnttecProOutput(settings.dmxPort)
enttec.setEnabled(settings.outputOnStart)
let win: BrowserWindow | null = null
const edit = new EditMode() // 시작은 항상 운영 모드

// 폰 원격: 설정에서 켰을 때만 같은 Wi-Fi에 연다. 접속 코드는 처음 한 번 만든다.
if (!settings.remoteCode) saveSettings({ ...settings, remoteCode: (settings.remoteCode = String(randomInt(1_000_000)).padStart(6, '0')) })
let remote: ReturnType<typeof startRemote> | null = null
let remoteError = ''
function setRemote(on: boolean) {
  remote?.close()
  remote = null
  remoteError = ''
  if (on) remote = startRemote({ code: () => settings.remoteCode, state: phoneState, run: phoneCmd, onError: (m) => { remoteError = m; console.error(m) } })
}
const sceneName = (id?: string) => engine.show.scenes.find((s) => s.id === id)?.name ?? ''
function phoneState(): PhoneState {
  const f = engine.currentFaders(Date.now())
  const top = Object.entries(f).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0]
  return {
    scene: top ? sceneName(top[0]) : '없음',
    cue: engine.cue,
    total: engine.show.cuelist.length,
    next: sceneName(engine.show.cuelist[engine.cue + 1]?.scene),
    blackout: engine.blackout,
    master: engine.master,
    fading: engine.fading,
    output: enttec.enabled && enttec.connected
  }
}
function phoneCmd(c: PhoneCmd) {
  try {
    if (c.c === 'blackout') engine.blackout = c.on
    else runCommand(engine, { t: c.c === 'next' ? 'nextCue' : 'default' }, Date.now())
  } catch (err) { console.error(err) }
}
setRemote(settings.remoteOn)

// DMX 출력 루프: 화면 그리기와 따로, 초당 40번(25ms) 일정하게 보낸다
setInterval(() => {
  const frame = engine.frame(Date.now())
  output.send(frame)
  enttec.send(frame)
}, 25)

/** 편집 모드가 닫히면(직접 닫기·10분 경과) 조명 찾기도 끝내고 원래 조명으로 돌아간다 */
function endFind() { if (engine.find) engine.setFind(Date.now(), null) }

function buildState() {
  const now = Date.now()
  if (!edit.isOpen(now)) endFind()
  return {
    live: engine.output(now),
    preview: engine.preview,
    previewOut: engine.previewOutput(),
    faders: engine.currentFaders(now),
    previewFaders: engine.previewFaders,
    faderMode: engine.faderMode,
    pending: engine.pending,
    cue: engine.cue,
    find: engine.find,
    master: engine.master,
    blackout: engine.blackout,
    fading: engine.fading,
    output: {
      enabled: enttec.enabled,
      connected: enttec.connected,
      port: enttec.path,
      error: enttec.error,
      preferred: enttec.preferred,
      onStart: settings.outputOnStart
    },
    frame: Array.from(output.last),
    editMode: edit.isOpen(now),
    pinSet: !!settings.pinHash,
    remote: { on: !!remote, code: settings.remoteCode, urls: lanUrls(), error: remoteError, clients: remote?.clients() ?? 0 },
    saveError,
    version: app.getVersion(),
    update: update.text
  }
}

// 화면에는 바뀌었을 때만 상태를 보낸다(초당 최대 20번). 처음 상태는 화면이 준비되면 직접 가져간다(state:get).
let lastSent = ''
setInterval(() => {
  if (!win) return
  const state = buildState()
  const json = JSON.stringify(state)
  if (json !== lastSent) win.webContents.send('state', state)
  lastSent = json
}, 50)

ipcMain.handle('show:get', () => engine.show)
ipcMain.handle('state:get', () => buildState())
ipcMain.handle('ports:list', () => listPorts())
// 편집 모드: PIN이 맞으면 연다. PIN이 아직 없으면 처음 정한 PIN으로 연다.
ipcMain.handle('edit:unlock', (_e, pin: string) => {
  if (!settings.pinHash || !checkPin(String(pin), settings.pinHash)) return false
  edit.open(Date.now())
  return true
})
ipcMain.handle('edit:setPin', (_e, pin: string, current?: string) => {
  pin = String(pin)
  // PIN 바꾸기는 편집 모드에서 현재 PIN까지 맞아야 한다(처음 정할 때는 예외)
  if (!isPin(pin)) return false
  if (settings.pinHash && (!edit.isOpen(Date.now()) || !checkPin(String(current ?? ''), settings.pinHash))) return false
  saveSettings({ ...settings, pinHash: (settings.pinHash = hashPin(pin)) })
  edit.open(Date.now())
  return true
})
ipcMain.handle('edit:lock', () => { edit.close(); endFind() })

ipcMain.on('cmd', (_e, c: Command) => {
  try {
    const now = Date.now()
    if (!edit.isOpen(now) && !allowedInOperation(c, engine.show)) return console.warn('운영 모드라 막은 명령', c.t)
    edit.touch(now)
    if (c.t === 'output') return enttec.setEnabled(c.on)
    if (c.t === 'dmxPort') { enttec.setPreferred(c.path); return saveSettings({ ...settings, dmxPort: (settings.dmxPort = c.path) }) }
    if (c.t === 'remote') { setRemote(c.on); return saveSettings({ ...settings, remoteOn: (settings.remoteOn = c.on) }) }
    if (c.t === 'outputOnStart') return saveSettings({ ...settings, outputOnStart: (settings.outputOnStart = c.on) })
    if (runCommand(engine, c, Date.now()) === 'showChanged') showChanged()
    if (c.t === 'faderMode') saveSettings({ ...settings, faderMode: (settings.faderMode = c.mode) })
  } catch (err) { console.error(err) }
})

app.whenReady().then(() => {
  startUpdater()
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    title: '빛길',
    backgroundColor: '#111318',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.removeMenu()
  win.on('closed', () => (win = null))
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
})

app.on('window-all-closed', () => app.quit())
