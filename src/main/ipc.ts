import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent
} from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/channels'
import type { CreateSessionInput, EnvironmentDiagnostic } from '../shared/types'
import {
  developmentOrigin,
  isTrustedRendererUrl
} from './renderer-trust'
import type { AppStore } from './store'
import type { SessionService } from './session-service'

interface IpcDependencies {
  getWindow: () => BrowserWindow | null
  store: AppStore
  sessions: SessionService
  getDiagnostics: () => Promise<EnvironmentDiagnostic>
  ensureDefaultWorkspace: () => void
  requestQuit: () => Promise<void>
}

function assertTrustedSender(
  event: IpcMainInvokeEvent,
  getWindow: () => BrowserWindow | null
): void {
  const window = getWindow()
  if (!window || window.isDestroyed()) throw new Error('应用窗口不可用。')
  if (event.sender !== window.webContents) throw new Error('拒绝来自未知窗口的 IPC 请求。')
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('拒绝来自未知文档框架的 IPC 请求。')
  }
  const rendererFile = join(__dirname, '../renderer/index.html')
  const devOrigin = app.isPackaged
    ? null
    : developmentOrigin(process.env.ELECTRON_RENDERER_URL)
  if (!isTrustedRendererUrl(event.senderFrame.url, rendererFile, devOrigin)) {
    throw new Error('拒绝来自不可信页面的 IPC 请求。')
  }
}

function assertString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value || value.length > maxLength) {
    throw new Error(`${label}无效。`)
  }
  return value
}

function assertDimension(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('终端尺寸无效。')
  }
  return Math.min(max, Math.max(min, Math.round(value)))
}

function assertCreateInput(value: unknown): CreateSessionInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('会话参数无效。')
  }
  const input = value as Record<string, unknown>
  const projectId = assertString(input.projectId, '项目 ID', 80)
  if (input.mode !== 'new' && input.mode !== 'continue' && input.mode !== 'resume') {
    throw new Error('会话启动方式无效。')
  }
  return {
    projectId,
    mode: input.mode,
    cols: assertDimension(input.cols, 20, 500),
    rows: assertDimension(input.rows, 5, 200)
  }
}

export function registerIpc(dependencies: IpcDependencies): void {
  const {
    getWindow,
    store,
    sessions,
    getDiagnostics,
    ensureDefaultWorkspace,
    requestQuit
  } = dependencies

  const handle = <Args extends unknown[], Result>(
    channel: string,
    handler: (...args: Args) => Promise<Result> | Result
  ): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertTrustedSender(event, getWindow)
      return handler(...(args as Args))
    })
  }

  handle(IPC.bootstrap, async () => {
    const snapshot = store.getSnapshot()
    return {
      ...snapshot,
      diagnostics: await getDiagnostics()
    }
  })

  handle(IPC.settingsUpdate, (patch: unknown) => {
    const settings = store.updateSettings(patch)
    getWindow()?.webContents.send(IPC.settingsChanged, settings)
    return settings
  })

  handle(IPC.projectsAdd, async () => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      title: '添加项目目录',
      buttonLabel: '添加项目',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const project = store.addProject(result.filePaths[0])
    getWindow()?.webContents.send(IPC.stateChanged, {
      projects: store.getProjects(),
      sessions: store.getSessions()
    })
    return project
  })

  handle(IPC.projectsRemove, async (projectId: unknown) => {
    const id = assertString(projectId, '项目 ID', 80)
    if (!store.getProject(id)) throw new Error('找不到该删除的项目。')
    await sessions.endProject(id)
    store.removeProject(id)
    ensureDefaultWorkspace()
    getWindow()?.webContents.send(IPC.stateChanged, {
      projects: store.getProjects(),
      sessions: store.getSessions()
    })
  })

  handle(IPC.sessionsCreate, (input: unknown) => sessions.create(assertCreateInput(input)))

  handle(IPC.sessionsWrite, (sessionId: unknown, data: unknown) => {
    const id = assertString(sessionId, '会话 ID', 80)
    const payload = assertString(data, '终端输入', 64 * 1024)
    sessions.write(id, payload)
  })

  handle(IPC.sessionsResize, (sessionId: unknown, cols: unknown, rows: unknown) => {
    const id = assertString(sessionId, '会话 ID', 80)
    sessions.resize(id, assertDimension(cols, 20, 500), assertDimension(rows, 5, 200))
  })

  handle(IPC.sessionsEnd, async (sessionId: unknown) => {
    const id = assertString(sessionId, '会话 ID', 80)
    await sessions.end(id)
  })

  handle(IPC.clipboardRead, () => clipboard.readText())
  handle(IPC.clipboardWrite, (value: unknown) => {
    clipboard.writeText(assertString(value, '剪贴板内容', 1024 * 1024))
  })

  handle(IPC.windowTheme, (value: unknown) => {
    if (typeof value !== 'object' || value === null) return
    const theme = value as Record<string, unknown>
    const background = typeof theme.background === 'string' ? theme.background : '#f4f0e8'
    const symbolColor = typeof theme.symbolColor === 'string' ? theme.symbolColor : '#3d352c'
    const window = getWindow()
    if (window && process.platform === 'win32') {
      window.setTitleBarOverlay({
        color: background,
        symbolColor,
        height: 48
      })
    }
  })

  handle(IPC.appRequestQuit, () => requestQuit())
}

