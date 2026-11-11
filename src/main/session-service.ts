import { AppStore } from './store'
import type { JobGuard } from './job-guard'
import { PtyManager } from './pty-manager'
import { resolveShell } from './diagnostics'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
  const waitForGuard = [
    '$gate = $env:CTD_PTY_GATE',
    '$parentPid = $env:CTD_PARENT_PID',
    'while ($gate -and -not (Test-Path -LiteralPath $gate)) {',
    '  if ($parentPid -and -not (Get-Process -Id ([int]$parentPid) -ErrorAction SilentlyContinue)) { exit 1 }',
    '  Start-Sleep -Milliseconds 25',
    '}',
    'if ($gate) { Remove-Item -LiteralPath $gate -Force -ErrorAction SilentlyContinue }',
    command
  ].join('; ')
  const args = ['-NoLogo']
  if (!loadProfile) args.push('-NoProfile')
  args.push('-NoExit', '-Command', waitForGuard)
  return args
}

export class SessionService {
  private readonly pty: PtyManager
  private writeEventCount = 0

  constructor(
    private readonly store: AppStore,
    private readonly callbacks: SessionServiceCallbacks,
    private readonly jobGuard?: JobGuard
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

  async create(input: CreateSessionInput): Promise<CreateSessionResult> {
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
    const runtimeDir = join(this.store.dataDir, 'runtime')
    const gatePath = join(runtimeDir, `${session.id}.gate`)
    mkdirSync(runtimeDir, { recursive: true })

    let pid: number
    try {
      pid = this.pty.spawn(session.id, {
        file: shell.path!,
        args: launchArguments(input.mode, settings.shell.loadProfile),
        cwd: project.path,
        cols: clamp(input.cols, 20, 500),
        rows: clamp(input.rows, 5, 200),
        env: {
          ...process.env,
          CTD_PARENT_PID: String(process.pid),
          CTD_PTY_GATE: gatePath
        }
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

    let processGuardApplied = false
    if (this.jobGuard?.isActive()) {
      processGuardApplied = await this.jobGuard.assign(session.id, pid)
      if (!processGuardApplied) {
        this.pty.kill(session.id)
        this.store.updateSession(session.id, {
          status: 'failed',
          endedAt: new Date().toISOString()
        })
        this.callbacks.onStateChanged()
        throw new Error('无法将终端进程纳入崩溃清理保护。')
      }
    }
    if (!this.store.getProject(project.id)) {
      this.pty.kill(session.id)
      this.store.removeSession(session.id)
      this.callbacks.onStateChanged()
      throw new Error('项目已在会话启动期间被移除。')
    }
    writeFileSync(gatePath, processGuardApplied ? 'READY\n' : 'SKIP\n', 'utf8')

    const running = this.store.updateSession(session.id, {
      status: 'running',
      lastActivityAt: new Date().toISOString()
    })
    this.callbacks.onStateChanged()
    const warnings: string[] = []
    if (concurrentSessions > 0) {
      warnings.push(
        `该项目已有 ${concurrentSessions} 个活动会话。多个 Claude 同时修改同一目录时，请注意文件冲突。`
      )
    }
    if (!this.jobGuard?.isActive()) {
      warnings.push(
        '进程级联保护不可用；若应用异常退出，Claude 子进程可能继续运行。'
      )
    }
    return {
      session: running ?? session,
      ...(warnings.length ? { warning: warnings.join(' ') } : {})
    }
  }

  write(sessionId: string, data: string): void {
    if (!this.pty.write(sessionId, data)) {
      throw new Error('终端会话已结束。')
    }
    if (data !== '\x1b[I' && data !== '\x1b[O') {
      this.writeEventCount += 1
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

    await this.stopSessions([sessionId], 1600)
  }

  async endProject(projectId: string): Promise<void> {
    const sessionIds = this.pty
      .activeSessionIds()
      .filter(
        (sessionId) =>
          this.store.getSession(sessionId)?.projectId === projectId
      )
    await this.stopSessions(sessionIds, 1800)
  }

  async endAll(): Promise<void> {
    await this.stopSessions(this.pty.activeSessionIds(), 1800)
  }

  activeCount(): number {
    return this.pty.activeCount()
  }

  activeProcessIds(): number[] {
    return this.pty.activePids()
  }

  testWriteEventCount(): number {
    return this.writeEventCount
  }

  private async stopSessions(
    sessionIds: string[],
    timeoutMs: number
  ): Promise<void> {
    if (!sessionIds.length) return
    for (const sessionId of sessionIds) this.pty.kill(sessionId)
    if (await this.waitForExit(sessionIds, timeoutMs)) {
      this.callbacks.onStateChanged()
      return
    }

    for (const sessionId of sessionIds) this.pty.forceKill(sessionId)
    if (await this.waitForExit(sessionIds, 1200)) {
      this.callbacks.onStateChanged()
      return
    }

    const endedAt = new Date().toISOString()
    for (const sessionId of sessionIds) {
      if (!this.pty.has(sessionId)) continue
      this.store.updateSession(sessionId, {
        status: 'failed',
        endedAt,
        lastActivityAt: endedAt
      })
    }
    this.callbacks.onStateChanged()
    throw new Error('部分终端进程未能结束，应用将继续运行。')
  }

  private async waitForExit(
    sessionIds: string[],
    timeoutMs: number
  ): Promise<boolean> {
    if (!sessionIds.some((sessionId) => this.pty.has(sessionId))) return true
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
    return !sessionIds.some((sessionId) => this.pty.has(sessionId))
  }
}

