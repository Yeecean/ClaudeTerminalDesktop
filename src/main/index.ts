import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  session,
  Tray
} from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { collectEnvironmentDiagnostics } from './diagnostics'
import { registerIpc } from './ipc'
import { startJobGuard, type JobGuard } from './job-guard'
import {
  developmentOrigin,
  isTrustedRendererUrl
} from './renderer-trust'
import { SessionService } from './session-service'
import { AppStore } from './store'
import { IPC } from '../shared/channels'
import { DEFAULT_SETTINGS } from '../shared/defaults'
import type { SessionRecord } from '../shared/types'

const testMode =
  process.env.CTD_E2E === '1' && process.argv.includes('--ctd-e2e')
const rendererFilePath = join(__dirname, '../renderer/index.html')
const trustedDevelopmentOrigin = app.isPackaged
  ? null
  : developmentOrigin(process.env.ELECTRON_RENDERER_URL)

app.setName('ClaudeTerminalDesktop')
app.setPath(
  'userData',
  testMode && process.env.CTD_USER_DATA_DIR
    ? resolve(process.env.CTD_USER_DATA_DIR)
    : join(app.getPath('appData'), 'ClaudeTerminalDesktop')
)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let store: AppStore | null = null
let sessionService: SessionService | null = null
let jobGuard: JobGuard | null = null
let allowQuit = false
let quitInProgress = false

function resourcePath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', name)
    : join(__dirname, '../../resources', name)
}

function defaultWorkspacePath(): string {
  if (testMode) return join(app.getPath('userData'), 'default-workspace')
  if (app.isPackaged) {
    return join(
      app.getPath('documents'),
      'Claude Terminal Desktop',
      'Default Workspace'
    )
  }
  return join(app.getAppPath(), 'default-workspace')
}

function ensureDefaultWorkspaceProject(): void {
  if (!store || store.getProjects().length > 0) return
  try {
    const workspacePath = defaultWorkspacePath()
    mkdirSync(workspacePath, { recursive: true })
    store.addProject(workspacePath, '默认工作区')
  } catch (error) {
    console.error('无法创建默认工作区。', error)
  }
}

function sendToRenderer(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return
  const activeCount = sessionService?.activeCount() ?? 0
  tray.setToolTip(
    activeCount > 0
      ? `Claude Terminal Desktop · ${activeCount} 个活动会话`
      : 'Claude Terminal Desktop'
  )
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示 Claude Terminal Desktop',
        click: showMainWindow
      },
      {
        label:
          activeCount > 0 ? `${activeCount} 个活动终端会话` : '没有活动终端会话',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '退出 Claude Terminal Desktop',
        click: () => {
          void requestQuit()
        }
      }
    ])
  )
}

function createTray(): void {
  if (tray) return
  const imagePath = resourcePath('icon.png')
  if (!existsSync(imagePath)) return
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) return

  tray = new Tray(image.resize({ width: 20, height: 20 }))
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTrayMenu()
}

async function requestQuit(): Promise<void> {
  if (quitInProgress) return

  const activeCount = testMode ? 0 : (sessionService?.activeCount() ?? 0)
  if (activeCount > 0) {
    const options = {
      type: 'warning' as const,
      buttons: ['取消', '结束会话并退出'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: '退出 Claude Terminal Desktop',
      message: `还有 ${activeCount} 个活动终端会话`,
      detail:
        '退出会结束这些 PTY 与 Claude Code 子进程。若只想暂时离开，可以取消并关闭窗口，让会话继续在托盘运行。'
    }
    const parent =
      mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
        ? mainWindow
        : undefined
    const result = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)
    if (result.response !== 1) return
  }

  quitInProgress = true
  try {
    await sessionService?.endAll()
    store?.shutdown()
    await jobGuard?.stop()
  } catch (error) {
    quitInProgress = false
    const message =
      error instanceof Error ? error.message : '无法结束全部终端进程。'
    const detail =
      '应用将继续运行，避免留下无法管理的后台进程。请在任务管理器中检查 PowerShell 或 Claude 进程后重试。'
    const parent =
      mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
        ? mainWindow
        : undefined
    if (parent) {
      await dialog.showMessageBox(parent, {
        type: 'error',
        title: '无法安全退出',
        message,
        detail,
        buttons: ['知道了']
      })
    } else {
      dialog.showErrorBox('无法安全退出', `${message}\n\n${detail}`)
    }
    return
  }
  allowQuit = true
  app.exit(0)
}

function createWindow(): void {
  const iconPath = resourcePath('icon.png')
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#f3eee5',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f3eee5',
      symbolColor: '#3a3129',
      height: 48
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = window

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('close', (event) => {
    if (allowQuit) return
    event.preventDefault()
    const hideOnClose = store?.getSettings().window.hideOnClose ?? true
    if (hideOnClose) {
      window.hide()
      updateTrayMenu()
    } else {
      void requestQuit()
    }
  })

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.on('session-end', () => {
    allowQuit = true
    void sessionService?.endAll().finally(() => store?.flush())
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (
      !isTrustedRendererUrl(
        navigationUrl,
        rendererFilePath,
        trustedDevelopmentOrigin
      )
    ) {
      event.preventDefault()
    }
  })

  if (
    !app.isPackaged &&
    process.env.ELECTRON_RENDERER_URL &&
    trustedDevelopmentOrigin
  ) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(rendererFilePath)
  }
}

async function initialize(): Promise<void> {
  app.setAppUserModelId('com.local.claudeterminaldesktop')
  Menu.setApplicationMenu(null)
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  jobGuard = startJobGuard(
    resourcePath('job-watchdog.ps1'),
    process.pid,
    join(app.getPath('userData'), 'job-guard')
  )
  await jobGuard.ready

  store = new AppStore(app.getPath('userData'))
  ensureDefaultWorkspaceProject()
  sessionService = new SessionService(
    store,
    {
      onData: (sessionId, data) => {
        sendToRenderer(IPC.ptyData, { sessionId, data })
      },
      onExit: (sessionRecord: SessionRecord, exitCode, signal) => {
        sendToRenderer(IPC.ptyExit, {
          sessionId: sessionRecord.id,
          exitCode,
          signal
        })
      },
      onStateChanged: () => {
        if (!store) return
        sendToRenderer(IPC.stateChanged, {
          projects: store.getProjects(),
          sessions: store.getSessions()
        })
        updateTrayMenu()
      }
    },
    jobGuard ?? undefined
  )

  if (testMode) {
    Object.defineProperty(globalThis, '__CTD_TEST__', {
      value: {
        activeCount: () => sessionService?.activeCount() ?? 0,
        activePids: () => sessionService?.activeProcessIds() ?? [],
        requestQuit: () => requestQuit()
      },
      configurable: true
    })
  }

  registerIpc({
    getWindow: () => mainWindow,
    store,
    sessions: sessionService,
    getDiagnostics: async () => {
      const settings = store?.getSettings() ?? structuredClone(DEFAULT_SETTINGS)
      return collectEnvironmentDiagnostics(
        settings,
        jobGuard?.isActive() ?? false,
        jobGuard?.error() ?? null
      )
    },
    ensureDefaultWorkspace: ensureDefaultWorkspaceProject,
    requestQuit
  })

  createWindow()
  createTray()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showMainWindow()
  })

  void app.whenReady().then(initialize)

  app.on('activate', showMainWindow)

  app.on('before-quit', (event) => {
    if (allowQuit) return
    event.preventDefault()
    void requestQuit()
  })

  app.on('will-quit', () => {
    store?.shutdown()
    tray?.destroy()
    tray = null
  })
}

