export type SessionStatus = 'starting' | 'running' | 'exited' | 'failed'

export type SessionLaunchMode = 'new' | 'continue' | 'resume'

export type LayoutMode = 'focus' | 'navigation' | 'parallel'

export type ThemeMode = 'light' | 'dark' | 'system'

export type DensityMode = 'compact' | 'comfortable'

export type CursorStyle = 'bar' | 'block' | 'underline'

export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
  lastOpenedAt: string
}

export interface SessionRecord {
  id: string
  projectId: string
  title: string
  status: SessionStatus
  createdAt: string
  lastActivityAt: string
  endedAt?: string
  exitCode?: number
}

export interface AppSettings {
  version: 1
  themeMode: ThemeMode
  layoutMode: LayoutMode
  gui: {
    fontFamily: string
    fontSize: number
    fontWeight: number
    density: DensityMode
  }
  terminal: {
    fontFamily: string
    fontSize: number
    fontWeight: number
    fontWeightBold: number
    lineHeight: number
    padding: number
    cursorStyle: CursorStyle
    cursorBlink: boolean
    scrollback: number
    scrollSensitivity: number
    background: string
    foreground: string
    cursorColor: string
    selectionBackground: string
    ansi: string[]
  }
  shell: {
    kind: 'windows-powershell' | 'powershell-7' | 'custom'
    customPath: string
    loadProfile: boolean
  }
  window: {
    hideOnClose: boolean
  }
}

export interface SettingsPatch {
  themeMode?: ThemeMode
  layoutMode?: LayoutMode
  gui?: Partial<AppSettings['gui']>
  terminal?: Partial<AppSettings['terminal']>
  shell?: Partial<AppSettings['shell']>
  window?: Partial<AppSettings['window']>
}

export interface ShellDiagnostic {
  kind: AppSettings['shell']['kind']
  label: string
  path: string | null
  available: boolean
  isCustom: boolean
}

export interface CliDiagnostic {
  available: boolean
  path: string | null
  version: string | null
  error: string | null
}

export interface EnvironmentDiagnostic {
  platform: string
  osVersion: string
  electronVersion: string
  nodeVersion: string
  appVersion: string
  shells: ShellDiagnostic[]
  cli: CliDiagnostic
  jobGuardActive: boolean
  jobGuardError: string | null
  configDirInherited: boolean
}

export interface BootstrapPayload {
  settings: AppSettings
  projects: Project[]
  sessions: SessionRecord[]
  diagnostics: EnvironmentDiagnostic
}

export interface CreateSessionInput {
  projectId: string
  mode: SessionLaunchMode
  cols: number
  rows: number
}

export interface CreateSessionResult {
  session: SessionRecord
  warning?: string
}

export interface PtyDataEvent {
  sessionId: string
  data: string
}

export interface PtyExitEvent {
  sessionId: string
  exitCode: number
  signal?: number
}

export interface StateChangedEvent {
  projects: Project[]
  sessions: SessionRecord[]
}

export interface WindowTheme {
  background: string
  symbolColor: string
}

