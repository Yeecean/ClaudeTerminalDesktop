import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'
import type {
  AppSettings,
  CreateSessionInput,
  PtyDataEvent,
  PtyExitEvent,
  SettingsPatch,
  StateChangedEvent,
  WindowTheme
} from '../shared/types'

function subscribe<T>(
  channel: string,
  listener: (value: T) => void
): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, value: T): void => {
    listener(value)
  }
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

contextBridge.exposeInMainWorld('ctd', {
  getBootstrap: () => ipcRenderer.invoke(IPC.bootstrap),
  updateSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke(IPC.settingsUpdate, patch),
  addProject: () => ipcRenderer.invoke(IPC.projectsAdd),
  removeProject: (projectId: string) =>
    ipcRenderer.invoke(IPC.projectsRemove, projectId),
  createSession: (input: CreateSessionInput) =>
    ipcRenderer.invoke(IPC.sessionsCreate, input),
  writeSession: (sessionId: string, data: string) =>
    ipcRenderer.invoke(IPC.sessionsWrite, sessionId, data),
  resizeSession: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.sessionsResize, sessionId, cols, rows),
  endSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC.sessionsEnd, sessionId),
  readClipboardText: () => ipcRenderer.invoke(IPC.clipboardRead),
  writeClipboardText: (text: string) =>
    ipcRenderer.invoke(IPC.clipboardWrite, text),
  setWindowTheme: (theme: WindowTheme) =>
    ipcRenderer.invoke(IPC.windowTheme, theme),
  requestQuit: () => ipcRenderer.invoke(IPC.appRequestQuit),
  onPtyData: (listener: (event: PtyDataEvent) => void) =>
    subscribe(IPC.ptyData, listener),
  onPtyExit: (listener: (event: PtyExitEvent) => void) =>
    subscribe(IPC.ptyExit, listener),
  onStateChanged: (listener: (event: StateChangedEvent) => void) =>
    subscribe(IPC.stateChanged, listener),
  onSettingsChanged: (listener: (settings: AppSettings) => void) =>
    subscribe(IPC.settingsChanged, listener)
})

