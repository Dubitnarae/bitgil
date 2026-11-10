import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { mergeScenes, scenesToXhd, xhdToScenes } from './xhd'
import { overlaps } from '../core/engine/patch'
import { join } from 'node:path'
import { Engine } from '../core/engine/engine'
import { VirtualOutput } from './dmx/output'
import { UsbDmxOutput, listPorts } from './dmx/enttec'
import { runCommand, type Command } from './commands'
import { loadSettings, saveSettings } from './settings'
import { loadShowFile, parseShow, saveShowFile } from './showfile'
import { allowedInOperation, canSetPinEnabled, canUnlock, checkPin, EditMode, hashPin, isPin } from './editmode'
import { randomInt } from 'node:crypto'
import { lanUrls, startRemote, type PhoneCmd, type PhoneState } from './remote/server'
import { cpus, totalmem } from 'node:os'
import { PRESETS, resolveQuality } from './quality'
import { checkNow, chooseUpdate, setAutoInstall, startUpdater, update } from './updater'
import { makeErrorLog } from './errorlog'

// 빛길은 하나만 켠다(둘이 같은 DMX 포트·쇼 파일을 잡지 않게). 두 번째는 아무것도 열기 전에 바로 끝내고, 먼저 켜진 창이 앞으로 나온다.
if (!app.requestSingleInstanceLock()) process.exit(0)
app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

// 오류 로그: %APPDATA%\빛길\error.log (settings.json 과 같은 폴더)
const logError = makeErrorLog(join(app.getPath('appData'), '빛길', 'error.log'))

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
const enttec = new UsbDmxOutput(settings.dmxPort, settings.dmxType)
enttec.setEnabled(settings.outputOnStart)
let win: BrowserWindow | null = null
// 출력이 켜져 있는 동안은 컴퓨터가 절전·화면 꺼짐으로 들어가지 않게 막는다(예배 중 조명 신호가 끊기지 않게)
let awake: number | null = null
function keepAwake() {
  if (enttec.enabled && awake === null) awake = powerSaveBlocker.start('prevent-display-sleep')
  else if (!enttec.enabled && awake !== null) { powerSaveBlocker.stop(awake); awake = null }
}
const edit = new EditMode() // 시작은 항상 운영 모드

// 폰 원격: 설정에서 켰을 때만 같은 Wi-Fi에 연다. 접속 코드는 처음 한 번 만든다.
if (!settings.remoteCode) saveSettings({ ...settings, remoteCode: (settings.remoteCode = String(randomInt(1_000_000)).padStart(6, '0')) })
let remote: ReturnType<typeof startRemote> | null = null
let remoteError = ''
function setRemote(on: boolean) {
  remote?.close()
  remote = null
  remoteError = ''
  if (on) remote = startRemote({ code: () => settings.remoteCode, state: phoneState, run: phoneCmd, unlock: phoneUnlock, setup: phoneSetup, onError: (m) => { remoteError = m; console.error(m) } })
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
    output: enttec.enabled && enttec.connected,
    edit: edit.isOpen(Date.now()),
    pinOff: !settings.pinEnabled,
    setup: edit.isOpen(Date.now()) ? {
      find: engine.find,
      chTest: engine.chTest,
      fixtures: engine.show.fixtures.map((x) => ({
        id: x.id, type: engine.show.fixture_types.find((t) => t.id === x.type)?.label ?? x.type,
        address: x.address, count: engine.show.fixture_types.find((t) => t.id === x.type)?.channel_count ?? 1,
        verified: x.verified, batten: x.batten ?? '바닥', direction: x.direction, position: x.position, aim: x.aim ?? null,
        clash: x.id === engine.find ? overlaps(engine.show, x.id) : []
      }))
    } : undefined
  }
}
/** 폰 설정 모드: 노트북과 같은 편집 PIN 으로 편집 모드를 연다(노트북도 편집 모드가 됨). 'PIN 사용'이 꺼져 있으면 PIN 없이 */
function phoneUnlock(pin: string) {
  if (!canUnlock(pin, settings)) return false
  edit.open(Date.now())
  phoneNote = { text: '설정 모드 열림', at: Date.now() }
  return true
}
// 폰 설정 모드에서 되는 명령: 조명 찾기·채널 시험·조명 고치기(주소·위치·방향·확인)·자리 바꾸기, 그리고 닫기
const PHONE_SETUP = ['find', 'chTest', 'editFixture', 'swapFixtures']
function phoneSetup(c: unknown): string {
  const cmd = c as Command | { t: 'lock' }
  if (!edit.isOpen(Date.now())) return '편집 모드가 닫혔습니다. PIN을 다시 넣어 주세요'
  if (cmd?.t === 'lock') { edit.close(); endFind(); phoneNote = { text: '설정 모드 닫음', at: Date.now() }; return '' }
  if (!PHONE_SETUP.includes(cmd?.t)) return '폰에서는 할 수 없는 명령입니다'
  try {
    edit.touch(Date.now())
    if (runCommand(engine, cmd as Command, Date.now()) === 'showChanged') showChanged()
    phoneNote = { text: cmd.t === 'find' ? (cmd.id ? `조명 찾기 ${cmd.id}` : '조명 찾기 끝') : cmd.t === 'chTest' ? (cmd.ch ? `채널 시험 ${cmd.ch}` : '채널 시험 끝') : cmd.t === 'swapFixtures' ? `자리 바꾸기 ${cmd.a} ↔ ${cmd.b}` : `조명 ${(cmd as { id: string }).id} 고침`, at: Date.now() }
    return ''
  } catch (err) { return err instanceof Error ? err.message : String(err) }
}
// 폰에서 누른 것을 노트북 화면에 잠깐 알린다(노트북 앞 사람이 놀라지 않게)
let phoneNote = { text: '', at: 0 }
function phoneCmd(c: PhoneCmd) {
  phoneNote = { text: c.c === 'blackout' ? (c.on ? '블랙아웃' : '블랙아웃 해제') : c.c === 'default' ? '기본 조명' : `다음 씬 — ${sceneName(engine.show.cuelist[engine.cue + 1]?.scene) || '없음'}`, at: Date.now() }
  try {
    if (c.c === 'blackout') engine.blackout = c.on
    else runCommand(engine, { t: c.c === 'next' ? 'nextCue' : 'default' }, Date.now())
  } catch (err) { console.error(err) }
}
setRemote(settings.remoteOn)

// DMX 출력 루프: 화면 그리기와 따로, 초당 40번(25ms) 일정하게 보낸다
// 한 번 오류가 나도 루프는 계속 돈다(조명이 멈추지 않게). 오류 난 프레임만 건너뛰고 장비는 마지막 값을 유지.
setInterval(() => {
  try {
    const frame = engine.frame(Date.now())
    output.send(frame)
    enttec.send(frame)
  } catch (err) { logError('출력 루프', err) }
}, 25)

/** 편집 모드가 닫히면(직접 닫기·10분 경과) 조명 찾기도 끝내고 원래 조명으로 돌아간다 */
function endFind() { if (engine.find) engine.setFind(Date.now(), null); engine.setChTest(null) }

const quality = () => resolveQuality(settings.quality, cpus().length, totalmem() / 1024 ** 3)

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
    chTest: engine.chTest,
    master: engine.master,
    blackout: engine.blackout,
    fading: engine.fading,
    output: {
      enabled: enttec.enabled,
      connected: enttec.connected,
      port: enttec.path,
      error: enttec.error,
      preferred: enttec.preferred,
      type: enttec.type,
      onStart: settings.outputOnStart
    },
    frame: Array.from(output.last),
    editMode: edit.isOpen(now),
    pinSet: !!settings.pinHash,
    pinEnabled: settings.pinEnabled,
    phone: phoneNote,
    remote: { on: !!remote, code: settings.remoteCode, urls: lanUrls(), error: remoteError, clients: remote?.clients() ?? 0 },
    saveError,
    version: app.getVersion(),
    quality: { set: settings.quality, used: quality(), cores: cpus().length, memGB: Math.round(totalmem() / 1024 ** 3) },
    update: { text: update.text, notice: update.notice, on: settings.autoUpdate, lastCheck: settings.lastUpdateCheck }
  }
}

// 화면에는 바뀌었을 때만 상태를 보낸다(간격은 화면 품질에 따라 33~100ms). 처음 상태는 화면이 준비되면 직접 가져간다(state:get).
let lastSent = ''
function sendState() {
  try {
    if (win) {
      const state = buildState()
      const json = JSON.stringify(state)
      if (json !== lastSent) win.webContents.send('state', state)
      lastSent = json
    }
  } catch (err) { logError('화면 상태 전송', err) } // 여기서 멈추면 화면이 굳으므로 다음 번을 꼭 예약한다
  setTimeout(sendState, PRESETS[quality()].stateMs)
}
sendState()

ipcMain.handle('show:get', () => engine.show)
ipcMain.handle('state:get', () => buildState())
ipcMain.handle('ports:list', () => listPorts())
// 편집 모드: PIN이 맞으면 연다('PIN 사용'이 꺼져 있으면 PIN 없이). PIN이 아직 없으면 처음 정한 PIN으로 연다.
ipcMain.handle('edit:unlock', (_e, pin: string) => {
  if (!canUnlock(String(pin), settings)) return false
  edit.open(Date.now())
  return true
})
// 'PIN 사용' 켜기/끄기: 편집 모드에서만, 끌 때는 현재 PIN 확인
ipcMain.handle('edit:pinEnabled', (_e, on: boolean, pin?: string) => {
  on = !!on
  const now = Date.now()
  if (!edit.isOpen(now) && !allowedInOperation({ t: 'pinEnabled', on }, engine.show)) return false
  if (!canSetPinEnabled(on, String(pin ?? ''), settings.pinHash)) return false
  edit.touch(now)
  saveSettings({ ...settings, pinEnabled: (settings.pinEnabled = on) })
  return true
})
ipcMain.handle('edit:setPin', (_e, pin: string, current?: string) => {
  pin = String(pin)
  // PIN 바꾸기는 편집 모드에서 현재 PIN까지 맞아야 한다(처음 정할 때는 예외)
  if (!isPin(pin)) return false
  if (settings.pinHash && (!edit.isOpen(Date.now()) || !checkPin(String(current ?? ''), settings.pinHash))) return false
  if (!settings.pinHash) settings.pinEnabled = true // PIN 없이 꺼 둔 상태에서 새 PIN을 정하면 PIN 사용도 켠다
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

// 쇼 파일 옮기기(교회 노트북 ↔ 집 컴퓨터, USB): 편집 모드에서만
const showFilter = [{ name: '빛길 쇼 파일', extensions: ['json'] }]
ipcMain.handle('show:export', async () => {
  if (!edit.isOpen(Date.now()) || !win) return '편집 모드에서만 할 수 있습니다'
  const d = new Date()
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const dst = await dialog.showSaveDialog(win, { title: '쇼 파일 내보내기 (USB 등)', defaultPath: `빛길 쇼 ${day}.bitgil.json`, filters: showFilter })
  if (dst.canceled || !dst.filePath) return ''
  try {
    writeFileSync(dst.filePath + '.tmp', JSON.stringify(engine.show, null, 2), 'utf-8')
    renameSync(dst.filePath + '.tmp', dst.filePath)
    return `내보냈습니다: ${dst.filePath}`
  } catch (err) { return `내보내지 못했습니다: ${err instanceof Error ? err.message : err}` }
})
ipcMain.handle('show:import', async () => {
  if (!edit.isOpen(Date.now()) || !win) return '편집 모드에서만 할 수 있습니다'
  const r = await dialog.showOpenDialog(win, { title: '쇼 파일 가져오기', filters: showFilter, properties: ['openFile'] })
  if (r.canceled || !r.filePaths[0]) return ''
  try {
    saveShowFile(showDir, parseShow(readFileSync(r.filePaths[0], 'utf-8'))) // 지금 쇼는 백업 폴더로
  } catch (err) { return `가져오지 못했습니다: ${err instanceof Error ? err.message : err}` }
  // 씬·조명이 통째로 바뀌므로 엔진을 새로 만들도록 다시 켠다(옛 값·페이더가 섞이지 않게)
  app.relaunch()
  app.exit(0)
  return ''
})

ipcMain.on('cmd', (_e, c: Command) => {
  try {
    const now = Date.now()
    if (!edit.isOpen(now) && !allowedInOperation(c, engine.show)) return console.warn('운영 모드라 막은 명령', c.t)
    edit.touch(now)
    if (c.t === 'output') { enttec.setEnabled(c.on); return keepAwake() }
    if (c.t === 'dmxType') { enttec.setType(c.type); return saveSettings({ ...settings, dmxType: (settings.dmxType = c.type) }) }
    if (c.t === 'dmxPort') { enttec.setPreferred(c.path); return saveSettings({ ...settings, dmxPort: (settings.dmxPort = c.path) }) }
    if (c.t === 'remote') { setRemote(c.on); return saveSettings({ ...settings, remoteOn: (settings.remoteOn = c.on) }) }
    if (c.t === 'remoteNewCode') {
      saveSettings({ ...settings, remoteCode: (settings.remoteCode = String(randomInt(1_000_000)).padStart(6, '0')) })
      return setRemote(!!remote) // 다시 열어 옛 코드로 붙어 있던 폰 연결을 끊는다
    }
    if (c.t === 'checkUpdate') return checkNow()
    if (c.t === 'updateChoice') { const skip = chooseUpdate(c.choice); if (skip) saveSettings({ ...settings, skipVersion: (settings.skipVersion = skip) }); return }
    if (c.t === 'autoUpdate') { setAutoInstall(c.on); return saveSettings({ ...settings, autoUpdate: (settings.autoUpdate = c.on) }) }
    if (c.t === 'quality') return saveSettings({ ...settings, quality: (settings.quality = c.set) })
    if (c.t === 'outputOnStart') return saveSettings({ ...settings, outputOnStart: (settings.outputOnStart = c.on) })
    if (runCommand(engine, c, Date.now()) === 'showChanged') showChanged()
    if (c.t === 'faderMode') saveSettings({ ...settings, faderMode: (settings.faderMode = c.mode) })
  } catch (err) { console.error(err) }
})

app.whenReady().then(() => {
  startUpdater({ on: settings.autoUpdate, lastCheck: settings.lastUpdateCheck, skip: () => settings.skipVersion, checked: (day) => saveSettings({ ...settings, lastUpdateCheck: (settings.lastUpdateCheck = day) }) })
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    title: '빛길',
    backgroundColor: '#111318',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.removeMenu()
  keepAwake() // '시작할 때 바로 출력'이 켜져 있을 때
  // 출력 중에 창을 닫으면 한 번 물어본다. 묻는 동안에도 출력 루프가 돌도록 기다리지 않는 창(showMessageBox)을 쓴다.
  win.on('close', (e) => {
    if (!enttec.enabled || !win) return
    e.preventDefault()
    dialog.showMessageBox(win, {
      type: 'warning', title: '빛길', message: '지금 조명으로 출력 중입니다.', detail: '빛길을 끄면 조명 신호가 끊깁니다. 그래도 끌까요?',
      buttons: ['끄기', '취소'], defaultId: 1, cancelId: 1, noLink: true
    }).then((r) => { if (r.response === 0) win?.destroy() })
  })
  win.on('closed', () => (win = null))
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
})

app.on('window-all-closed', () => app.quit())

// 예상 못 한 오류는 로그에 남기고 계속 돈다(예배 중 꺼지지 않게).
// 파일 맨 끝에 두는 이유: 위쪽 시작 준비가 실패하면 Electron 기본 오류 창이 그대로 뜨게.
process.on('uncaughtException', (err) => logError('uncaughtException', err))
process.on('unhandledRejection', (err) => logError('unhandledRejection', err))
