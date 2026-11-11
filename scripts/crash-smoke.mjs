import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const projectPath = process.cwd()
const artifactRoot = resolve(projectPath, 'test-results', 'crash')
const userDataPath = join(artifactRoot, 'user-data')
const packagedExecutable = process.env.CTD_E2E_EXECUTABLE
  ? resolve(process.env.CTD_E2E_EXECUTABLE)
  : null
const environment = {
  ...process.env,
  CTD_E2E: '1',
  CTD_USER_DATA_DIR: userDataPath,
  ELECTRON_RENDERER_URL: packagedExecutable
    ? 'https://example.invalid/should-not-load'
    : ''
}
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

function processIsAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function processSnapshot() {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$items = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine); ConvertTo-Json -InputObject $items -Compress'
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000
    }
  )
  const parsed = JSON.parse(output)
  return Array.isArray(parsed) ? parsed : []
}

function descendantPids(rootPids, processes) {
  const found = new Set(rootPids)
  let changed = true
  while (changed) {
    changed = false
    for (const processEntry of processes) {
      if (
        !found.has(processEntry.ProcessId) &&
        found.has(processEntry.ParentProcessId)
      ) {
        found.add(processEntry.ProcessId)
        changed = true
      }
    }
  }
  for (const rootPid of rootPids) found.delete(rootPid)
  return [...found]
}

async function waitFor(check, label, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await check()) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function launch() {
  if (packagedExecutable) {
    return electron.launch({
      executablePath: packagedExecutable,
      args: ['--ctd-e2e'],
      env: environment
    })
  }
  return electron.launch({
    args: ['.', '--ctd-e2e'],
    cwd: projectPath,
    env: environment
  })
}

rmSync(artifactRoot, { recursive: true, force: true })
mkdirSync(userDataPath, { recursive: true })

let electronApp
let trackedTree = []
try {
  electronApp = await launch()
  const page = await electronApp.firstWindow()
  page.setDefaultTimeout(10000)
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: '启动新会话', exact: true }).waitFor()
  assert.equal(
    (await page.locator('aside').innerText()).includes('默认工作区'),
    true
  )
  const diagnostics = await page.evaluate(async () => {
    const bootstrap = await window.ctd.getBootstrap()
    return {
      jobGuardActive: bootstrap.diagnostics.jobGuardActive,
      jobGuardError: bootstrap.diagnostics.jobGuardError
    }
  })
  console.log('Process guard:', diagnostics)
  assert.equal(diagnostics.jobGuardActive, true)

  await electronApp.evaluate(async ({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [selectedPath]
    })
  }, projectPath)
  await page.getByRole('button', { name: '添加项目', exact: true }).click()
  await waitFor(
    () =>
      page
        .locator('aside button[data-project-id][aria-current="true"]')
        .innerText()
        .then((text) => text.includes('ccDesktop')),
    'project selection after add'
  )
  await page.getByRole('button', { name: '启动新会话' }).click()
  await page.locator('.xterm').waitFor()
  await waitFor(
    () => electronApp.evaluate(() => globalThis.__CTD_TEST__.activeCount() === 1),
    'PTY start'
  )

  const roots = await electronApp.evaluate(() => globalThis.__CTD_TEST__.activePids())
  let snapshot = []
  let descendants = []
  await waitFor(
    () => {
      snapshot = processSnapshot()
      descendants = descendantPids(roots, snapshot)
      return (
        descendants.length > 0 &&
        snapshot.some(
          (processEntry) =>
            descendants.includes(processEntry.ProcessId) &&
            /claude/i.test(processEntry.CommandLine ?? '')
        )
      )
    },
    'Claude CLI descendant start',
    15000
  )
  const tree = [...roots, ...descendants]
  trackedTree = tree

  const mainPid = await electronApp.evaluate(() => process.pid)
  const crashClosed = electronApp.waitForEvent('close').catch(() => {})
  process.kill(mainPid, 'SIGKILL')
  await Promise.race([crashClosed, sleep(5000)])
  electronApp = null

  await waitFor(
    () => tree.every((pid) => !processIsAlive(pid)),
    'crash orphan cleanup',
    10000
  )
  trackedTree = []

  electronApp = await launch()
  const restartedPage = await electronApp.firstWindow()
  restartedPage.setDefaultTimeout(10000)
  await restartedPage.waitForLoadState('domcontentloaded')
  await restartedPage.getByText('准备开始新的终端会话').waitFor()
  assert.equal(
    await electronApp.evaluate(() => globalThis.__CTD_TEST__.activeCount()),
    0
  )
  assert.equal(existsSync(join(userDataPath, 'sessions.json')), true)
  const sessions = JSON.parse(
    readFileSync(join(userDataPath, 'sessions.json'), 'utf8')
  )
  assert.equal(
    sessions.some(
      (session) => session.status === 'running' || session.status === 'starting'
    ),
    false
  )
  const restartedMainPid = await electronApp.evaluate(() => process.pid)
  console.log('Restarted main pid:', restartedMainPid)
  await electronApp
    .evaluate(() => globalThis.__CTD_TEST__.requestQuit())
    .catch(() => {})
  await waitFor(
    () => !processIsAlive(restartedMainPid),
    'restarted application quit'
  )
  electronApp = null

  console.log(
    `Crash smoke passed${packagedExecutable ? ' (packaged)' : ''}: forced main-process termination left no PTY or Claude descendant, and restart marked the session interrupted.`
  )
} catch (error) {
  if (trackedTree.length) {
    const latest = processSnapshot()
    const alive = trackedTree
      .filter((pid) => processIsAlive(pid))
      .map((pid) => {
        const entry = latest.find((item) => item.ProcessId === pid)
        return {
          pid,
          parentPid: entry?.ParentProcessId ?? null,
          name: entry?.Name ?? null,
          commandLine: entry?.CommandLine ?? null
        }
      })
    console.error('Alive tracked processes after crash:', alive)
    for (const rootPid of trackedTree.filter((pid) => processIsAlive(pid))) {
      spawnSync(
        `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`,
        ['/PID', String(rootPid), '/T', '/F'],
        { windowsHide: true, stdio: 'ignore' }
      )
    }
  }
  if (electronApp) {
    await Promise.race([
      electronApp.close().catch(() => {}),
      sleep(3000)
    ])
  }
  console.error(error)
  process.exitCode = 1
  setTimeout(() => process.exit(1), 100)
}
