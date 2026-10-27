/// <reference lib="dom" />
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dailywork', {
  platform: process.platform,
  revealDataDir: () => ipcRenderer.invoke('dailywork:reveal-data-dir'),
  restart: () => ipcRenderer.invoke('dailywork:restart'),
  version: () => ipcRenderer.invoke('dailywork:version'),
  dataDir: () => ipcRenderer.invoke('dailywork:data-dir'),
})

window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('desktop')
})
