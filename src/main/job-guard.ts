import { spawn, type ChildProcess } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

const READY_TIMEOUT_MS = 15000
const ASSIGN_TIMEOUT_MS = 5000
const POLL_MS = 50

export interface JobGuard {
  ready: Promise<boolean>
  isActive: () => boolean
  error: () => string | null
  assign: (sessionId: string, pid: number) => Promise<boolean>
  stop: () => Promise<void>
}

function powershellPath(): string {
  return join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
}

function readStatus(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim()
  } catch {
    return null
  }
}

export function startJobGuard(
  scriptPath: string,
  parentPid: number,
  controlDir: string
): JobGuard {
  const unavailable = (message: string): JobGuard => ({
    ready: Promise.resolve(false),
    isActive: () => false,
    error: () => message,
    assign: async () => false,
    stop: async () => {}
  })

  if (!existsSync(scriptPath)) {
    return unavailable(`找不到进程保护脚本：${scriptPath}`)
  }

  const requestsDir = join(controlDir, 'requests')
  const resultsDir = join(controlDir, 'results')
  const statusFile = join(controlDir, 'guard.status')
  const debugFile =
    process.env.CTD_E2E === '1'
      ? join(controlDir, 'guard-debug.log')
      : null
  const logEvent = (message: string): void => {
    if (!debugFile) return
    try {
      appendFileSync(debugFile, `${new Date().toISOString()} ${message}\n`, 'utf8')
    } catch {}
  }

  rmSync(controlDir, { recursive: true, force: true })
  mkdirSync(requestsDir, { recursive: true })
  mkdirSync(resultsDir, { recursive: true })

  let child: ChildProcess | null = null
  let active = false
  let settled = false
  let errorMessage = ''
  let readyPoll: NodeJS.Timeout | null = null
  let readyTimeout: NodeJS.Timeout | null = null
  let resolveReady: (value: boolean) => void = () => {}
  const readyPromise = new Promise<boolean>((resolve) => {
    resolveReady = resolve
  })

  const finishReady = (value: boolean, message?: string): void => {
    if (settled) return
    settled = true
    if (message) errorMessage = message
    if (readyPoll) clearInterval(readyPoll)
    if (readyTimeout) clearTimeout(readyTimeout)
    rmSync(statusFile, { force: true })
    resolveReady(value)
  }
  const markFailed = (message: string): void => {
    active = false
    errorMessage = message
    finishReady(false, message)
  }

  try {
    child = spawn(
      powershellPath(),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-ParentPid',
        String(parentPid),
        '-ControlDir',
        controlDir,
        '-StatusFile',
        statusFile,
        ...(debugFile ? ['-LogPath', debugFile] : [])
      ],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    )
    logEvent(`spawned pid=${child.pid ?? 'unknown'}`)
    child.unref()
  } catch {
    return unavailable('无法启动进程级联保护。')
  }

  readyTimeout = setTimeout(() => {
    markFailed('进程级联保护启动超时。')
  }, READY_TIMEOUT_MS)
  readyTimeout.unref()

  readyPoll = setInterval(() => {
    const status = readStatus(statusFile)
    if (!status) return
    if (status === 'READY') {
      active = true
      finishReady(true)
      return
    }
    if (status.startsWith('ERROR:')) {
      markFailed(status.slice('ERROR:'.length).trim())
    }
  }, POLL_MS)
  readyPoll.unref()

  child.on('error', (error) => {
    logEvent(`error ${error.message}`)
    markFailed(error.message)
  })
  child.on('exit', (code, signal) => {
    logEvent(`exit code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    if (active) markFailed('进程级联保护意外退出。')
  })

  const assign = async (sessionId: string, pid: number): Promise<boolean> => {
    if (!active || !child || child.exitCode !== null) return false
    if (!/^[A-Za-z0-9-]{1,80}$/.test(sessionId) || !Number.isInteger(pid)) {
      return false
    }

    const requestPath = join(requestsDir, `${sessionId}.request`)
    const temporaryPath = `${requestPath}.${process.pid}.${Date.now()}.tmp`
    const readyPath = join(resultsDir, `${sessionId}.ready`)
    const errorPath = join(resultsDir, `${sessionId}.error`)
    try {
      writeFileSync(temporaryPath, `${JSON.stringify({ pid })}\n`, 'utf8')
      renameSync(temporaryPath, requestPath)
    } catch {
      return false
    }

    const started = Date.now()
    while (Date.now() - started < ASSIGN_TIMEOUT_MS) {
      if (existsSync(readyPath)) {
        rmSync(readyPath, { force: true })
        rmSync(errorPath, { force: true })
        return true
      }
      if (existsSync(errorPath)) {
        const message = readStatus(errorPath)
        logEvent(`assign-failed ${message ?? 'unknown error'}`)
        rmSync(errorPath, { force: true })
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    logEvent(`assign-timeout session=${sessionId}`)
    return false
  }

  const stop = async (): Promise<void> => {
    if (!child || child.exitCode !== null) return
    const exited = new Promise<void>((resolve) => {
      child?.once('exit', () => resolve())
    })
    child.kill()
    await Promise.race([
      exited,
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000)
        timer.unref()
      })
    ])
  }

  return {
    ready: readyPromise,
    isActive: () => active && child !== null && child.exitCode === null,
    error: () => {
      if (active) return null
      return errorMessage || '进程级联保护未就绪；异常退出时可能仍有后台进程。'
    },
    assign,
    stop
  }
}
