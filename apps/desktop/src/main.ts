import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
  utilityProcess,
  dialog,
  type UtilityProcess,
} from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

app.setName('Dailywork')
app.setAppUserModelId('com.lingzhi.dailywork')

const isDev = !app.isPackaged
const dataDir = process.env.DAILYWORK_DATA_DIR ?? join(app.getPath('appData'), 'Dailywork')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let serverProcess: UtilityProcess | null = null
let quitting = false

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
}

function stateFile(): string {
  return join(dataDir, 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState
  } catch {
    return { width: 1440, height: 960 }
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds()
    writeFileSync(stateFile(), JSON.stringify(bounds), { mode: 0o600 })
  } catch {
    // ignore
  }
}

async function waitForUrl(url: string, timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) })
      if (res.ok || res.status === 404) return true
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

function readRuntime(): { url: string; port: number } | null {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'runtime.json'), 'utf8')) as {
      url: string
      port: number
      pid?: number
    }
    return raw.url ? raw : null
  } catch {
    return null
  }
}

async function startLocalServer(): Promise<string> {
  const serverModule = join(process.resourcesPath, 'server', 'server.mjs')
  if (!existsSync(serverModule)) {
    throw new Error(`找不到本地服务：${serverModule}`)
  }
  serverProcess = utilityProcess.fork(serverModule, [], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DAILYWORK_DATA_DIR: dataDir,
      DAILYWORK_PORT: '0',
      DAILYWORK_HOST: '0.0.0.0',
      DAILYWORK_WEB_DIST: join(process.resourcesPath, 'web'),
      DAILYWORK_VERSION: app.getVersion(),
    },
    stdio: 'pipe',
    serviceName: 'Dailywork Server',
  })
  serverProcess.stdout?.on('data', (chunk: Buffer) => {
    if (isDev) process.stdout.write(`[server] ${chunk.toString()}`)
  })
  serverProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[server] ${chunk.toString()}`)
  })
  serverProcess.on('exit', (code) => {
    if (!quitting) {
      dialog.showErrorBox('本地服务已停止', `服务进程退出（代码 ${code}）。请重启应用。`)
    }
  })
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const runtime = readRuntime()
    const url = runtime ? `http://127.0.0.1:${runtime.port}` : null
    if (url && (await waitForUrl(url, 1000))) return url
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('本地服务启动超时')
}

async function resolveAppUrl(): Promise<string> {
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'
    const ok = await waitForUrl(url, 30_000)
    if (!ok) throw new Error(`Vite 开发服务器未就绪：${url}`)
    return url
  }
  return startLocalServer()
}

async function createWindow(): Promise<void> {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 620,
    title: '时序 · Dailywork',
    backgroundColor: '#FAF9F5',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  try {
    const url = await resolveAppUrl()
    await mainWindow.loadURL(url)
    if (isDev && process.env.DAILYWORK_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } catch (error) {
    dialog.showErrorBox(
      '无法启动时序',
      `${error instanceof Error ? error.message : String(error)}\n\n数据目录：${dataDir}`,
    )
  }
}

function createTray(): void {
  const trayIconPath = join(process.resourcesPath, 'tray.png')
  const devIconPath = join(__dirname, '..', 'build', 'tray.png')
  const icon = nativeImage.createFromPath(existsSync(trayIconPath) ? trayIconPath : devIconPath)
  tray = new Tray(icon.resize({ width: 18, height: 18 }))
  tray.setToolTip('时序 · Dailywork')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开时序',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        },
      },
      {
        label: '今天',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
          void mainWindow?.webContents.executeJavaScript("window.location.href='/today'")
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.hide()
    else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: '视图',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

ipcMain.handle('dailywork:reveal-data-dir', async () => {
  return shell.openPath(dataDir)
})
ipcMain.handle('dailywork:restart', () => {
  quitting = true
  app.relaunch()
  app.exit(0)
})
ipcMain.handle('dailywork:version', () => app.getVersion())
ipcMain.handle('dailywork:data-dir', () => dataDir)
ipcMain.handle('dailywork:pick-backup', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 .dailywork 备份',
    properties: ['openFile'],
    filters: [{ name: 'Dailywork 备份', extensions: ['dailywork'] }],
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    buildMenu()
    createTray()
    await createWindow()
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!mainWindow) return
      if (mainWindow.isVisible()) mainWindow.hide()
      else {
        mainWindow.show()
        mainWindow.focus()
      }
    })
    app.on('activate', () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      } else {
        void createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    quitting = true
    globalShortcut.unregisterAll()
    try {
      serverProcess?.kill()
    } catch {
      // ignore
    }
  })

  app.on('window-all-closed', () => {
    // Keep running in the menu bar on macOS.
  })
}
