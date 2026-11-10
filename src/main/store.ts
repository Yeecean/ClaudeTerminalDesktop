import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { normalizeSettings, mergeSettings } from '../shared/settings'
import type {
  AppSettings,
  Project,
  SessionRecord,
  SessionStatus
} from '../shared/types'

const SESSION_STATUSES: SessionStatus[] = ['starting', 'running', 'exited', 'failed']
const MAX_STORED_SESSIONS = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeProject(value: unknown): Project | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.path !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.lastOpenedAt !== 'string'
  ) {
    return null
  }
  if (!value.id || !value.path) return null
  return {
    id: value.id.slice(0, 80),
    name: value.name.slice(0, 120) || basename(value.path),
    path: resolve(value.path),
    createdAt: value.createdAt,
    lastOpenedAt: value.lastOpenedAt
  }
}

function normalizeSession(value: unknown): SessionRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.lastActivityAt !== 'string'
  ) {
    return null
  }
  if (!SESSION_STATUSES.includes(value.status as SessionStatus)) return null
  return {
    id: value.id.slice(0, 80),
    projectId: value.projectId.slice(0, 80),
    title: value.title.slice(0, 120),
    status: value.status as SessionStatus,
    createdAt: value.createdAt,
    lastActivityAt: value.lastActivityAt,
    ...(typeof value.endedAt === 'string' ? { endedAt: value.endedAt } : {}),
    ...(typeof value.exitCode === 'number' ? { exitCode: value.exitCode } : {})
  }
}

function readJson(filePath: string): unknown {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  } catch {
    const backupPath = `${filePath}.corrupt-${Date.now()}`
    try {
      renameSync(filePath, backupPath)
    } catch {}
    return null
  }
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporaryPath, filePath)
}

export interface StoreSnapshot {
  settings: AppSettings
  projects: Project[]
  sessions: SessionRecord[]
}

export class AppStore {
  readonly dataDir: string
  private settings: AppSettings
  private projects: Project[]
  private sessions: SessionRecord[]
  private saveTimer: NodeJS.Timeout | null = null

  constructor(dataDir: string) {
    this.dataDir = dataDir
    mkdirSync(dataDir, { recursive: true })

    this.settings = normalizeSettings(readJson(this.settingsPath))
    this.projects = this.readProjects()
    this.sessions = this.readSessions()
    this.markInterruptedSessions()
    this.scheduleSave(25)
  }

  private get settingsPath(): string {
    return join(this.dataDir, 'settings.json')
  }

  private get projectsPath(): string {
    return join(this.dataDir, 'projects.json')
  }

  private get sessionsPath(): string {
    return join(this.dataDir, 'sessions.json')
  }

  private readProjects(): Project[] {
    const value = readJson(this.projectsPath)
    if (!Array.isArray(value)) return []
    return value
      .map(normalizeProject)
      .filter((project): project is Project => project !== null)
  }

  private readSessions(): SessionRecord[] {
    const value = readJson(this.sessionsPath)
    if (!Array.isArray(value)) return []
    return value
      .map(normalizeSession)
      .filter((session): session is SessionRecord => session !== null)
      .slice(-MAX_STORED_SESSIONS)
  }

  private markInterruptedSessions(): void {
    const now = new Date().toISOString()
    let changed = false
    this.sessions = this.sessions.map((session) => {
      if (session.status !== 'starting' && session.status !== 'running') return session
      changed = true
      return {
        ...session,
        status: 'exited',
        endedAt: now
      }
    })
    if (changed) this.markSessionsDirty()
  }

  getSnapshot(): StoreSnapshot {
    return {
      settings: structuredClone(this.settings),
      projects: structuredClone(this.projects),
      sessions: structuredClone(this.sessions)
    }
  }

  getSettings(): AppSettings {
    return structuredClone(this.settings)
  }

  updateSettings(patch: unknown): AppSettings {
    this.settings = mergeSettings(this.settings, patch)
    this.scheduleSave(120)
    return this.getSettings()
  }

  getProjects(): Project[] {
    return structuredClone(this.projects)
  }

  getProject(id: string): Project | undefined {
    const project = this.projects.find((item) => item.id === id)
    return project ? structuredClone(project) : undefined
  }

  addProject(projectPath: string, displayName?: string): Project {
    const resolvedPath = resolve(projectPath)
    if (!existsSync(resolvedPath) || !statSync(resolvedPath).isDirectory()) {
      throw new Error('所选路径不是有效目录。')
    }

    const existing = this.projects.find(
      (project) => project.path.toLocaleLowerCase() === resolvedPath.toLocaleLowerCase()
    )
    if (existing) {
      existing.lastOpenedAt = new Date().toISOString()
      this.scheduleSave(80)
      return structuredClone(existing)
    }

    const now = new Date().toISOString()
    const project: Project = {
      id: randomUUID(),
      name: (displayName?.trim() || basename(resolvedPath) || resolvedPath).slice(0, 120),
      path: resolvedPath,
      createdAt: now,
      lastOpenedAt: now
    }
    this.projects.push(project)
    this.scheduleSave(80)
    return structuredClone(project)
  }

  removeProject(projectId: string): string[] {
    const removedSessionIds = this.sessions
      .filter((session) => session.projectId === projectId)
      .map((session) => session.id)
    this.projects = this.projects.filter((project) => project.id !== projectId)
    this.sessions = this.sessions.filter((session) => session.projectId !== projectId)
    this.scheduleSave(80)
    return removedSessionIds
  }

  touchProject(projectId: string): void {
    const project = this.projects.find((item) => item.id === projectId)
    if (!project) return
    project.lastOpenedAt = new Date().toISOString()
    this.scheduleSave(1000)
  }

  getSessions(): SessionRecord[] {
    return structuredClone(this.sessions)
  }

  getSession(id: string): SessionRecord | undefined {
    const session = this.sessions.find((item) => item.id === id)
    return session ? structuredClone(session) : undefined
  }

  getActiveSessions(): SessionRecord[] {
    return structuredClone(
      this.sessions.filter(
        (session) => session.status === 'starting' || session.status === 'running'
      )
    )
  }

  countSessionsForProject(projectId: string): number {
    return this.sessions.filter((session) => session.projectId === projectId).length
  }

  createSession(projectId: string, title: string): SessionRecord {
    if (!this.getProject(projectId)) {
      throw new Error('找不到对应项目。')
    }
    const now = new Date().toISOString()
    const session: SessionRecord = {
      id: randomUUID(),
      projectId,
      title: title.slice(0, 120),
      status: 'starting',
      createdAt: now,
      lastActivityAt: now
    }
    this.sessions.push(session)
    this.touchProject(projectId)
    this.markSessionsDirty()
    return structuredClone(session)
  }

  updateSession(
    id: string,
    patch: Partial<Pick<SessionRecord, 'status' | 'lastActivityAt' | 'endedAt' | 'exitCode'>>
  ): SessionRecord | undefined {
    const session = this.sessions.find((item) => item.id === id)
    if (!session) return undefined
    Object.assign(session, patch)
    this.markSessionsDirty()
    return structuredClone(session)
  }

  touchSession(id: string): void {
    const session = this.sessions.find((item) => item.id === id)
    if (!session) return
    session.lastActivityAt = new Date().toISOString()
    this.markSessionsDirty()
  }

  removeSession(id: string): void {
    this.sessions = this.sessions.filter((session) => session.id !== id)
    this.markSessionsDirty()
  }

  private markSessionsDirty(): void {
    if (this.sessions.length > MAX_STORED_SESSIONS) {
      this.sessions = this.sessions.slice(-MAX_STORED_SESSIONS)
    }
    this.scheduleSave(250)
  }

  private scheduleSave(delay: number): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.flush()
    }, delay)
    this.saveTimer.unref()
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    writeJsonAtomic(this.settingsPath, this.settings)
    writeJsonAtomic(this.projectsPath, this.projects)
    writeJsonAtomic(this.sessionsPath, this.sessions)
  }

  shutdown(): void {
    this.flush()
  }
}

