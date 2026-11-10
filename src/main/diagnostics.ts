import { execFile, execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { release } from 'node:os'
import { app } from 'electron'
import type {
  AppSettings,
  CliDiagnostic,
  EnvironmentDiagnostic,
  ShellDiagnostic
} from '../shared/types'

function findExecutable(name: string): string | null {
  try {
    const output = execFileSync('where.exe', [name], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    })
    const candidate = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && existsSync(line))
    return candidate ?? null
  } catch {
    return null
  }
}

function runCommand(
  file: string,
  args: string[],
  timeout = 8000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        maxBuffer: 256 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      }
    )
  })
}

function shellDiagnostic(
  kind: ShellDiagnostic['kind'],
  label: string,
  candidate: string | null
): ShellDiagnostic {
  const available = Boolean(candidate && existsSync(candidate) && statSync(candidate).isFile())
  return {
    kind,
    label,
    path: candidate,
    available,
    isCustom: kind === 'custom'
  }
}

export function detectShells(settings: AppSettings): ShellDiagnostic[] {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const windowsPowerShell = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  const powerShell7 = findExecutable('pwsh.exe')
  const custom = settings.shell.customPath.trim()

  const shells = [
    shellDiagnostic('windows-powershell', 'Windows PowerShell', windowsPowerShell),
    shellDiagnostic('powershell-7', 'PowerShell 7', powerShell7)
  ]

  if (custom) {
    shells.push(
      shellDiagnostic('custom', basename(custom) || '自定义 PowerShell', custom)
    )
  }

  return shells
}

export function resolveShell(settings: AppSettings): ShellDiagnostic {
  const shells = detectShells(settings)
  const selected =
    shells.find((shell) => shell.kind === settings.shell.kind) ??
    shells.find((shell) => shell.available)

  if (!selected) {
    throw new Error('没有可用的 PowerShell。')
  }
  if (!selected.available) {
    throw new Error(`所选 PowerShell 不可用：${selected.label}`)
  }
  return selected
}

async function detectClaude(): Promise<CliDiagnostic> {
  const claudePath = findExecutable('claude')
  if (!claudePath) {
    return {
      available: false,
      path: null,
      version: null,
      error: '未在 PATH 中找到 claude。请确认 Claude Code CLI 已正确安装。'
    }
  }

  try {
    const result = await runCommand(claudePath, ['--version'])
    const version = result.stdout.trim().split(/\r?\n/)[0] ?? null
    return {
      available: true,
      path: claudePath,
      version,
      error: null
    }
  } catch (error) {
    return {
      available: false,
      path: claudePath,
      version: null,
      error: error instanceof Error ? error.message : 'Claude Code CLI 版本检查失败。'
    }
  }
}

export async function collectEnvironmentDiagnostics(
  settings: AppSettings
): Promise<EnvironmentDiagnostic> {
  const cli = await detectClaude()
  return {
    platform: process.platform,
    osVersion:
      typeof process.getSystemVersion === 'function'
        ? process.getSystemVersion()
        : release(),
    electronVersion: process.versions.electron ?? 'unknown',
    nodeVersion: process.versions.node,
    appVersion: app.getVersion(),
    shells: detectShells(settings),
    cli,
    configDirInherited: Boolean(process.env.CLAUDE_CONFIG_DIR)
  }
}

