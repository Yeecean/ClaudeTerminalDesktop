import { AppStore } from './store'
import { PtyManager } from './pty-manager'
import { resolveShell } from './diagnostics'
import type {
  CreateSessionInput,
  CreateSessionResult,
  SessionLaunchMode,
  SessionRecord
} from '../shared/types'

const LAUNCH_MODES: SessionLaunchMode[] = ['new', 'continue', 'resume']

export interface SessionServiceCallbacks {
  onData: (sessionId: string, data: string) => void
  onExit: (session: SessionRecord, exitCode: number, signal?: number) => void
  onStateChanged: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function launchArguments(mode: SessionLaunchMode, loadProfile: boolean): string[] {
  const command = mode === 'new' ? '& claude' : mode === 'continue' ? '& claude -c' : '& claude -r'
  const args = ['-NoLogo']
  if (!loadProfile) args.push('-NoProfile')
  args.push('-NoExit', '-Command', command)
  return args
}

export class SessionService {
  private readonly pty: PtyManager

  constructor(
    private readonly store: AppStore,
    private readonly callbacks: SessionServiceCallbacks
  ) {
    this.pty = new PtyManager({
      onData: (sessionId, data) => {
        this.store.touchSession(sessionId)
        this.callbacks.onData(sessionId, data)
      },
      onExit: (sessionId, exitCode, signal) => {
        const session = this.store.updateSession(sessionId, {
          status: 'exited',
          endedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          exitCode
        })
        if (session) this.callbacks.onExit(session, exitCode, signal)
        this.callbacks.onStateChanged()
      }
    })
  }

  create(input: CreateSessionInput): CreateSessionResult {
    if (!LAUNCH_MODES.includes(input.mode)) throw new Error('不支持的会话启动方式。')
    const project = this.store.getProject(input.projectId)
    if (!project) throw new Error('找不到对应项目。')

    const settings = this.store.getSettings()
    const shell = resolveShell(settings)
    const concurrentSessions = this.store
      .getActiveSessions()
      .filter((activeSession) => activeSession.projectId === project.id).length
    const number = this.store.countSessionsForProject(project.id) + 1
    const title =
      input.mode === 'new'
        ? `Claude ${number}`
        : input.mode === 'continue'
          ? `继续会话 ${number}`
          : `恢复历史 ${number}`

    const session = this.store.createSession(project.id, title)
    this.callbacks.onStateChanged()

    try {
      this.pty.spawn(session.id, {
        file: shell.path!,
        args: launchArguments(input.mode, settings.shell.loadProfile),
        cwd: project.path,
        cols: clamp(input.cols, 20, 500),
        rows: clamp(input.rows, 5, 200),
        env: process.env
      })
    } catch (error) {
      this.store.updateSession(session.id, {
        status: 'failed',
        endedAt: new Date().toISOString()
      })
      this.callbacks.onStateChanged()
      throw new Error(
        `无法启动 ${shell.label}。请检查终端诊断与 ConPTY 环境。${
          error instanceof Error ? ` ${error.message}` : ''
        }`
      )
    }

    const running = this.store.updateSession(session.id, {
      status: 'running',
      lastActivityAt: new Date().toISOString()
    })
    this.callbacks.onStateChanged()
    return {
      session: running ?? session,
      ...(concurrentSessions > 0
        ? {
            warning: `该项目已有 ${concurrentSessions} 个活动会话。多个 Claude 同时修改同一目录时，请注意文件冲突。`
          }
        : {})
    }
  }

  write(sessionId: string, data: string): void {
    if (!this.pty.write(sessionId, data)) {
      throw new Error('终端会话已结束。')
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.pty.resize(
      sessionId,
      clamp(cols, 20, 500),
      clamp(rows, 5, 200)
    )
  }

  async end(sessionId: string): Promise<void> {
    if (!this.store.getSession(sessionId)) throw new Error('找不到该会话。')
    if (!this.pty.has(sessionId)) return

    this.pty.kill(sessionId)
    await this.waitForExit([sessionId], 1600)
    this.callbacks.onStateChanged()
  }

  async endProject(projectId: string): Promise<void> {
    const sessionIds = this.store
      .getActiveSessions()
      .filter((session) => session.projectId === projectId)
      .map((session) => session.id)
    for (const sessionId of sessionIds) this.pty.kill(sessionId)
    await this.waitForExit(sessionIds, 1800)
    this.callbacks.onStateChanged()
  }

  async endAll(): Promise<void> {
    const active = this.store.getActiveSessions()
    const sessionIds = active.map((session) => session.id)
    await this.pty.killAll()
    await this.waitForExit(sessionIds, 1200)
    for (const sessionId of sessionIds) {
      const session = this.store.getSession(sessionId)
      if (session?.status === 'starting' || session?.status === 'running') {
        this.store.updateSession(sessionId, {
          status: 'exited',
          endedAt: new Date().toISOString()
        })
      }
    }
    this.callbacks.onStateChanged()
  }

  activeCount(): number {
    return this.store
      .getActiveSessions()
      .filter((session) => this.pty.has(session.id)).length
  }

  activeProcessIds(): number[] {
    return this.pty.activePids()
  }

  private async waitForExit(sessionIds: string[], timeoutMs: number): Promise<void> {
    if (!sessionIds.some((sessionId) => this.pty.has(sessionId))) return
    await new Promise<void>((resolve) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (
          !sessionIds.some((sessionId) => this.pty.has(sessionId)) ||
          Date.now() - started >= timeoutMs
        ) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    })
  }
}

