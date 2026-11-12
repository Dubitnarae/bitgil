import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bitgil', {
  getShow: () => ipcRenderer.invoke('show:get'),
  getState: () => ipcRenderer.invoke('state:get'),
  listPorts: () => ipcRenderer.invoke('ports:list'),
  udmxDriverState: () => ipcRenderer.invoke('udmx:driverState'),
  udmxInstallDriver: () => ipcRenderer.invoke('udmx:installDriver'),
  send: (cmd: unknown) => ipcRenderer.send('cmd', cmd),
  unlock: (pin: string) => ipcRenderer.invoke('edit:unlock', pin),
  setPin: (pin: string, current?: string) => ipcRenderer.invoke('edit:setPin', pin, current),
  pinEnabled: (on: boolean, pin?: string) => ipcRenderer.invoke('edit:pinEnabled', on, pin),
  lock: () => ipcRenderer.invoke('edit:lock'),
  xhdImport: () => ipcRenderer.invoke('xhd:import'),
  xhdExport: () => ipcRenderer.invoke('xhd:export'),
  showExport: () => ipcRenderer.invoke('show:export'),
  showImport: () => ipcRenderer.invoke('show:import'),
  onShow: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('show', h)
    return () => ipcRenderer.off('show', h)
  },
  onState: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('state', h)
    return () => ipcRenderer.off('state', h)
  }
})
