import { spawnSync } from 'node:child_process'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

const OUTPUT_FLUSH_MS = 12
const OUTPUT_FLUSH_THRESHOLD = 512 * 1024

interface ManagedProcess {
  sessionId: string
  terminal: IPty
  decoder: TextDecoder
  pendingOutput: string[]
  pendingLength: number
  flushTimer: NodeJS.Timeout | null
  forcedKillTimer: NodeJS.Timeout | null
  closing: boolean
}

export interface PtySpawnOptions {
  file: string
  args: string[]
  cwd: string
  cols: number
  rows: number
  env: NodeJS.ProcessEnv
}

export interface PtyManagerCallbacks {
  onData: (sessionId: string, data: string) => void
  onExit: (sessionId: string, exitCode: number, signal?: number) => void
}

export function sanitizedEnvironment(
  environment: NodeJS.ProcessEnv
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(environment)) {
    if (typeof value === 'string') result[key] = value
  }
  result.TERM = 'xterm-256color'
  result.COLORTERM = 'truecolor'
  result.TERM_PROGRAM = 'ClaudeTerminalDesktop'
  delete result.NO_COLOR
  delete result.CLICOLOR
  delete result.CLICOLOR_FORCE
  return result
}

export class PtyManager {
  private readonly processes = new Map<string, ManagedProcess>()

  constructor(private readonly callbacks: PtyManagerCallbacks) {}

  spawn(sessionId: string, options: PtySpawnOptions): number {
    if (this.processes.has(sessionId)) {
      throw new Error('该会话已经存在。')
    }

    const terminal = pty.spawn(options.file, options.args, {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: sanitizedEnvironment(options.env),
      encoding: null,
      useConpty: true,
      conptyInheritCursor: true
    })

    const processEntry: ManagedProcess = {
      sessionId,
      terminal,
      decoder: new TextDecoder('utf-8', { fatal: false }),
      pendingOutput: [],
      pendingLength: 0,
      flushTimer: null,
      forcedKillTimer: null,
      closing: false
    }
    this.processes.set(sessionId, processEntry)

    terminal.onData((data: string) => {
      const bytes =
        typeof data === 'string'
          ? Buffer.from(data, 'utf8')
          : (data as unknown as Uint8Array)
      const decoded = processEntry.decoder.decode(bytes, { stream: true })
      if (!decoded) return
      this.queueOutput(sessionId, processEntry, decoded)
    })

    terminal.onExit(({ exitCode, signal }) => {
      const finalText = processEntry.decoder.decode()
      if (finalText) this.queueOutput(sessionId, processEntry, finalText)
      this.flushOutput(processEntry)

      if (processEntry.forcedKillTimer) {
        clearTimeout(processEntry.forcedKillTimer)
        processEntry.forcedKillTimer = null
      }
      this.processes.delete(sessionId)
      this.callbacks.onExit(sessionId, exitCode, signal)
    })

    return terminal.pid
  }

  write(sessionId: string, data: string): boolean {
    const processEntry = this.processes.get(sessionId)
    if (!processEntry || processEntry.closing) return false
    processEntry.terminal.write(data)
    return true
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const processEntry = this.processes.get(sessionId)
    if (!processEntry || processEntry.closing) return false
    processEntry.terminal.resize(cols, rows)
    return true
  }

  has(sessionId: string): boolean {
    return this.processes.has(sessionId)
  }

  activeCount(): number {
    return this.processes.size
  }

  activePids(): number[] {
    return [...this.processes.values()].map((entry) => entry.terminal.pid)
  }

  activeSessionIds(): string[] {
    return [...this.processes.keys()]
  }

  forceKill(sessionId: string): void {
    const processEntry = this.processes.get(sessionId)
    if (!processEntry) return
    const pid = processEntry.terminal.pid
    spawnSync(
      `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`,
      ['/PID', String(pid), '/T', '/F'],
      {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000
      }
    )
  }

  kill(sessionId: string): void {
    const processEntry = this.processes.get(sessionId)
    if (!processEntry || processEntry.closing) return
    processEntry.closing = true

    try {
      processEntry.terminal.kill()
    } catch {}

    processEntry.forcedKillTimer = setTimeout(() => {
      if (!this.processes.has(sessionId)) return
      this.forceKill(sessionId)
    }, 900)
    processEntry.forcedKillTimer.unref()
  }

  async killAll(timeoutMs = 1800): Promise<void> {
    for (const sessionId of this.processes.keys()) {
      this.kill(sessionId)
    }
    if (this.processes.size === 0) return

    await new Promise<void>((resolve) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (this.processes.size === 0 || Date.now() - started >= timeoutMs) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    })
  }

  private queueOutput(
    sessionId: string,
    processEntry: ManagedProcess,
    text: string
  ): void {
    processEntry.pendingOutput.push(text)
    processEntry.pendingLength += text.length

    if (processEntry.pendingLength >= OUTPUT_FLUSH_THRESHOLD) {
      this.flushOutput(processEntry)
      return
    }
    if (!processEntry.flushTimer) {
      processEntry.flushTimer = setTimeout(() => {
        this.flushOutput(processEntry)
      }, OUTPUT_FLUSH_MS)
      processEntry.flushTimer.unref()
    }
  }

  private flushOutput(processEntry: ManagedProcess): void {
    if (processEntry.flushTimer) {
      clearTimeout(processEntry.flushTimer)
      processEntry.flushTimer = null
    }
    if (!processEntry.pendingOutput.length) return

    const output = processEntry.pendingOutput.join('')
    processEntry.pendingOutput = []
    processEntry.pendingLength = 0
    this.callbacks.onData(processEntry.sessionId, output)
  }
}

