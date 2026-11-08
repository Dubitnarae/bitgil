import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mergeScenes, scenesToXhd, xhdToScenes } from './xhd'
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
import { chooseUpdate, setAutoInstall, startUpdater, update } from './updater'

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
    update: { text: update.text, notice: update.notice, on: settings.autoUpdate, lastCheck: settings.lastUpdateCheck }
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

// 기존 콘솔(Mini Pearl 1024 Pro) 백업 파일: 편집 모드에서만. 결과 문구를 화면에 돌려준다.
const xhdFilter = [{ name: 'Mini Pearl 백업 (.XHD)', extensions: ['XHD', 'xhd'] }]
ipcMain.handle('xhd:import', async () => {
  if (!edit.isOpen(Date.now()) || !win) return '편집 모드에서만 할 수 있습니다'
  const r = await dialog.showOpenDialog(win, { title: '콘솔 백업에서 씬 불러오기', filters: xhdFilter, properties: ['openFile'] })
  if (r.canceled || !r.filePaths[0]) return ''
  try {
    const { replaced, added } = mergeScenes(engine.show, xhdToScenes(readFileSync(r.filePaths[0]), engine.show))
    showChanged()
    return `불러왔습니다: 새 씬 ${added}개, 같은 번호라 값을 바꾼 씬 ${replaced}개 (이전 쇼는 백업 폴더에 있음)`
  } catch (err) { return `불러오지 못했습니다: ${err instanceof Error ? err.message : err}` }
})
ipcMain.handle('xhd:export', async () => {
  if (!edit.isOpen(Date.now()) || !win) return '편집 모드에서만 할 수 있습니다'
  const src = await dialog.showOpenDialog(win, { title: '바탕이 될 콘솔 원본 백업 고르기 (원본은 바뀌지 않음)', filters: xhdFilter, properties: ['openFile'] })
  if (src.canceled || !src.filePaths[0]) return ''
  const base = src.filePaths[0]
  const dst = await dialog.showSaveDialog(win, { title: '내보낼 파일 이름', defaultPath: base.replace(/\.xhd$/i, '') + ' 빛길.XHD', filters: xhdFilter })
  if (dst.canceled || !dst.filePath) return ''
  if (dst.filePath.toLowerCase() === base.toLowerCase()) return '원본 백업은 그대로 두어야 합니다. 다른 이름으로 저장해 주세요'
  try {
    const { buf, written, skipped, unpatched } = scenesToXhd(readFileSync(base), engine.show)
    writeFileSync(dst.filePath + '.tmp', buf)
    renameSync(dst.filePath + '.tmp', dst.filePath)
    return `내보냈습니다: 씬 ${written.length}개` +
      (skipped.length ? ` · 콘솔에 같은 자리(P페이지-페이더)가 없어 뺀 씬: ${skipped.join(', ')}` : '') +
      (unpatched ? ` · 콘솔 패치에 없는 채널 값 ${unpatched}개는 빠짐` : '')
  } catch (err) { return `내보내지 못했습니다: ${err instanceof Error ? err.message : err}` }
})

ipcMain.on('cmd', (_e, c: Command) => {
  try {
    const now = Date.now()
    if (!edit.isOpen(now) && !allowedInOperation(c, engine.show)) return console.warn('운영 모드라 막은 명령', c.t)
    edit.touch(now)
    if (c.t === 'output') return enttec.setEnabled(c.on)
    if (c.t === 'dmxPort') { enttec.setPreferred(c.path); return saveSettings({ ...settings, dmxPort: (settings.dmxPort = c.path) }) }
    if (c.t === 'remote') { setRemote(c.on); return saveSettings({ ...settings, remoteOn: (settings.remoteOn = c.on) }) }
    if (c.t === 'updateChoice') { const skip = chooseUpdate(c.choice); if (skip) saveSettings({ ...settings, skipVersion: (settings.skipVersion = skip) }); return }
    if (c.t === 'autoUpdate') { setAutoInstall(c.on); return saveSettings({ ...settings, autoUpdate: (settings.autoUpdate = c.on) }) }
    if (c.t === 'outputOnStart') return saveSettings({ ...settings, outputOnStart: (settings.outputOnStart = c.on) })
    if (runCommand(engine, c, Date.now()) === 'showChanged') showChanged()
    if (c.t === 'faderMode') saveSettings({ ...settings, faderMode: (settings.faderMode = c.mode) })
  } catch (err) { console.error(err) }
})

app.whenReady().then(() => {
  startUpdater({ on: settings.autoUpdate, lastCheck: settings.lastUpdateCheck, skip: settings.skipVersion, checked: (day) => saveSettings({ ...settings, lastUpdateCheck: (settings.lastUpdateCheck = day) }) })
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
