import type {
  AppSettings,
  BootstrapPayload,
  CreateSessionInput,
  CreateSessionResult,
  Project,
  PtyDataEvent,
  PtyExitEvent,
  SettingsPatch,
  StateChangedEvent,
  WindowTheme
} from './types'

export interface CtdApi {
  getBootstrap: () => Promise<BootstrapPayload>
  updateSettings: (patch: SettingsPatch) => Promise<AppSettings>
  addProject: () => Promise<Project | null>
  removeProject: (projectId: string) => Promise<void>
  createSession: (input: CreateSessionInput) => Promise<CreateSessionResult>
  writeSession: (sessionId: string, data: string) => Promise<void>
  resizeSession: (sessionId: string, cols: number, rows: number) => Promise<void>
  endSession: (sessionId: string) => Promise<void>
  readClipboardText: () => Promise<string>
  writeClipboardText: (text: string) => Promise<void>
  setWindowTheme: (theme: WindowTheme) => Promise<void>
  requestQuit: () => Promise<void>
  onPtyData: (listener: (event: PtyDataEvent) => void) => () => void
  onPtyExit: (listener: (event: PtyExitEvent) => void) => () => void
  onStateChanged: (listener: (event: StateChangedEvent) => void) => () => void
  onSettingsChanged: (listener: (settings: AppSettings) => void) => () => void
}

