import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const projectPath = process.cwd()
const artifactRoot = resolve(projectPath, 'test-results', 'e2e')
const userDataPath = join(artifactRoot, 'user-data')
const screenshots = join(artifactRoot, 'screenshots')
const secondProjectPath = join(artifactRoot, 'second-project')
const packagedExecutable = process.env.CTD_E2E_EXECUTABLE
  ? resolve(process.env.CTD_E2E_EXECUTABLE)
  : null

rmSync(artifactRoot, { recursive: true, force: true })
mkdirSync(screenshots, { recursive: true })
mkdirSync(secondProjectPath, { recursive: true })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const environment = {
  ...process.env,
  CTD_E2E: '1',
  CTD_USER_DATA_DIR: userDataPath,
  ELECTRON_RENDERER_URL: packagedExecutable
    ? 'https://example.invalid/should-not-load'
    : ''
}

function launchApplication() {
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
      '$items = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine); ConvertTo-Json -InputObject $items -Compress'
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

async function waitFor(check, label, timeout = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await check()) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

let electronApp
let closed = false
const pageErrors = []

try {
  electronApp = await launchApplication()

  electronApp.on('close', () => {
    closed = true
  })

  const page = await electronApp.firstWindow()
  page.setDefaultTimeout(10000)
  page.on('pageerror', (error) => pageErrors.push(error.message))

  const activeCount = () =>
    electronApp.evaluate(() => globalThis.__CTD_TEST__.activeCount())
  const activePids = () =>
    electronApp.evaluate(() => globalThis.__CTD_TEST__.activePids())

  await page.waitForLoadState('domcontentloaded')
  await page.getByText('从一个项目开始').waitFor()
  assert.equal(await page.title(), 'Claude Terminal Desktop')
  assert.equal(
    await page.evaluate(async () => {
      const bootstrap = await window.ctd.getBootstrap()
      return bootstrap.diagnostics.jobGuardActive
    }),
    true
  )
  assert.equal(page.url().startsWith('file:'), true)
  const contentSecurityPolicy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  assert.ok(contentSecurityPolicy)
  assert.match(contentSecurityPolicy, /script-src 'self'/)
  assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*unsafe-inline/)
  assert.doesNotMatch(contentSecurityPolicy, /unsafe-eval/)
  const windowCountBefore = electronApp.windows().length
  const popupOpened = page
    .waitForEvent('popup', { timeout: 500 })
    .then(() => true)
    .catch(() => false)
  await page.evaluate(() => {
    window.open('https://example.invalid/popup')
  })
  assert.equal(await popupOpened, false)
  assert.equal(electronApp.windows().length, windowCountBefore)

  await electronApp.evaluate(async ({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [selectedPath]
    })
  }, projectPath)

  await page.getByRole('button', { name: '添加项目目录' }).click()
  await page.getByText('准备开始新的终端会话').waitFor()
  assert.equal(await page.locator('aside').innerText().then((text) => text.includes('ccDesktop')), true)
  await page.screenshot({ path: join(screenshots, '01-project-added.png') })

  await page.getByRole('button', { name: '启动新会话' }).click()
  await page.getByText('PTY 运行中').waitFor()
  await waitFor(async () => (await activeCount()) === 1, 'first PTY')
  await page.locator('.xterm').waitFor()
  await page.locator('.xterm canvas').first().waitFor()
  await page.waitForFunction(() => {
    const terminalElement = document.querySelector('.xterm')
    return (
      terminalElement instanceof HTMLElement &&
      Number(terminalElement.dataset.ctdCols) > 40 &&
      Number(terminalElement.dataset.ctdRows) > 20
    )
  })
  const terminalRendering = await page
    .locator('.terminal-host')
    .first()
    .evaluate((host) => {
      const terminalElement = host.querySelector('.xterm')
      const canvas = host.querySelector('canvas')
      if (!(terminalElement instanceof HTMLElement)) return null
      if (!(canvas instanceof HTMLCanvasElement)) return null
      const hostRect = host.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      const canvasWidth = canvasRect.width
      const canvasHeight = canvasRect.height
      return {
        canvasLeft: canvasRect.left - hostRect.left,
        canvasTop: canvasRect.top - hostRect.top,
        canvasRight: hostRect.right - canvasRect.right,
        canvasBottom: hostRect.bottom - canvasRect.bottom,
        canvasWidth,
        canvasHeight
      }
    })
  assert.ok(terminalRendering, 'terminal renderer elements')
  assert.equal(
    Math.round(terminalRendering.canvasLeft),
    0,
    'terminal canvas left inset'
  )
  assert.equal(
    Math.round(terminalRendering.canvasTop),
    0,
    'terminal canvas top inset'
  )
  assert.ok(terminalRendering.canvasRight <= 18, 'terminal canvas right inset')
  assert.ok(
    terminalRendering.canvasBottom <= 9,
    `terminal canvas bottom inset: ${JSON.stringify(terminalRendering)}`
  )
  assert.ok(terminalRendering.canvasWidth > 600, 'terminal canvas width')
  assert.ok(terminalRendering.canvasHeight > 500, 'terminal canvas height')
  const initialGeometry = await page
    .locator('.terminal-host')
    .first()
    .evaluate(async (host) => {
      const terminalElement = host.querySelector('.xterm')
      if (!(terminalElement instanceof HTMLElement)) return null
      const cols = Number(terminalElement.dataset.ctdCols)
      const rows = Number(terminalElement.dataset.ctdRows)
      return { cols, rows }
    })
  assert.ok(initialGeometry?.cols > 40, 'initial terminal columns')
  assert.ok(initialGeometry?.rows > 20, 'initial terminal rows')
  await page.screenshot({ path: join(screenshots, '02-claude-cli.png') })

  await page.keyboard.press('Control+Shift+N')
  await waitFor(async () => (await activeCount()) === 2, 'second PTY')
  const pidsBeforeSwitch = await activePids()
  await page.locator('aside button[title^="Claude 1"]').click()
  assert.equal(await activeCount(), 2)
  assert.deepEqual((await activePids()).sort(), pidsBeforeSwitch.sort())

  await electronApp.evaluate(async ({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [selectedPath]
    })
  }, secondProjectPath)
  await page.getByRole('button', { name: '添加项目', exact: true }).click()
  await page.getByText('准备开始新的终端会话').waitFor()
  assert.equal(await page.locator('.terminal-host').count(), 2)
  const firstTerminalHost = page.locator('.terminal-host').first()
  await firstTerminalHost.evaluate((element) => {
    element.dataset.ctdBufferedProbe = 'preserved'
  })
  await page
    .locator('aside button')
    .filter({ hasText: 'ccDesktop' })
    .first()
    .click()
  await page.locator('.terminal-host:visible').first().waitFor()
  assert.equal(await activeCount(), 2)
  assert.equal(
    await firstTerminalHost.evaluate(
      (element) => element.dataset.ctdBufferedProbe
    ),
    'preserved'
  )

  await page.getByTitle('并行模式').click()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.terminal-host:visible').count(), 2)
  await page.screenshot({ path: join(screenshots, '02b-parallel-mode.png') })
  await page.getByTitle('导航模式').click()
  await page.locator('.xterm:visible').first().click()
  await page.keyboard.press('Control+f')
  const searchInput = page.getByPlaceholder('在终端中查找')
  await searchInput.waitFor()
  await searchInput.press('Escape')
  await page.getByPlaceholder('在终端中查找').waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: '打开设置' }).click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

  const brand = page.getByText('Claude Terminal', { exact: true })
  const terminalGeometry = async () => {
    const terminalElement = page.locator('.terminal-host:visible .xterm').first()
    return terminalElement.evaluate((element) => ({
      cols: Number(element.dataset.ctdCols),
      rows: Number(element.dataset.ctdRows)
    }))
  }
  const sizeBefore = Number.parseFloat(
    await brand.evaluate((element) => getComputedStyle(element).fontSize)
  )
  const guiSizeSlider = page.getByLabel('界面字号', { exact: true })
  await guiSizeSlider.focus()
  await guiSizeSlider.press('End')
  await waitFor(
    async () =>
      Number.parseFloat(
        await brand.evaluate((element) => getComputedStyle(element).fontSize)
      ) > sizeBefore + 3,
    'GUI font scaling'
  )
  await sleep(500)

  const initialTerminalGeometry = await terminalGeometry()
  await page.getByRole('button', { name: '终端' }).click()
  const terminalSizeSlider = page.getByLabel('终端字号', { exact: true })
  await terminalSizeSlider.focus()
  await terminalSizeSlider.press('End')
  await waitFor(
    async () => {
      const next = await terminalGeometry()
      return (
        next.cols < initialTerminalGeometry.cols &&
        next.rows < initialTerminalGeometry.rows
      )
    },
    'terminal font scaling geometry'
  )
  await waitFor(
    async () => {
      const persistedSettings = JSON.parse(
        readFileSync(join(userDataPath, 'settings.json'), 'utf8')
      )
      return persistedSettings.terminal.fontSize === 32
    },
    'terminal font persistence'
  )

  const persisted = JSON.parse(readFileSync(join(userDataPath, 'settings.json'), 'utf8'))
  assert.equal(persisted.themeMode, 'dark')
  assert.equal(persisted.gui.fontSize, 20)
  assert.equal(persisted.terminal.fontSize, 32)
  await page.screenshot({ path: join(screenshots, '03-settings-dark.png') })

  await page.getByRole('button', { name: '诊断' }).click()
  await page.getByRole('heading', { name: 'Claude Code', exact: true }).waitFor()
  await page.screenshot({ path: join(screenshots, '04-diagnostics.png') })
  await page.getByRole('button', { name: '关闭设置' }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(screenshots, '05-dark-workspace.png') })

  const pidsBeforeEnd = await activePids()
  const processesBeforeEnd = processSnapshot()
  const descendantsBeforeEnd = descendantPids(pidsBeforeEnd, processesBeforeEnd)
  assert.ok(descendantsBeforeEnd.length > 0, 'expected live PTY descendants')
  assert.ok(
    processesBeforeEnd.some(
      (processEntry) =>
        descendantsBeforeEnd.includes(processEntry.ProcessId) &&
        /claude/i.test(processEntry.CommandLine ?? '')
    ),
    'expected a live Claude CLI descendant'
  )
  await page.getByRole('button', { name: '结束当前会话' }).click()
  await page.getByRole('button', { name: '结束会话' }).click()
  await waitFor(async () => (await activeCount()) === 1, 'ending a session')
  const pidsAfterEnd = await activePids()
  const endedPid = pidsBeforeEnd.find((pid) => !pidsAfterEnd.includes(pid))
  assert.ok(endedPid)
  const endedTree = [endedPid, ...descendantPids([endedPid], processesBeforeEnd)]
  await waitFor(
    () => endedTree.every((pid) => !processIsAlive(pid)),
    'PTY process tree cleanup'
  )

  assert.equal(
    await electronApp.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()
    ),
    true
  )
  await electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close()
  )
  await waitFor(
    () =>
      electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible()
      ).then((visible) => !visible),
    'hide to tray'
  )
  assert.equal(await activeCount(), 1)
  await electronApp.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.show()
    window.focus()
  })
  await waitFor(
    () =>
      electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible()
      ),
    'restore from tray'
  )

  const remainingRootPids = await activePids()
  const remainingTree = [
    ...remainingRootPids,
    ...descendantPids(remainingRootPids, processSnapshot())
  ]
  await electronApp
    .evaluate(() => globalThis.__CTD_TEST__.requestQuit())
    .catch(() => {})
  await waitFor(() => closed, 'application quit', 10000)
  await waitFor(
    () => remainingTree.every((pid) => !processIsAlive(pid)),
    'remaining PTY process tree cleanup'
  )

  closed = false
  electronApp = await launchApplication()
  electronApp.on('close', () => {
    closed = true
  })
  const restartedPage = await electronApp.firstWindow()
  restartedPage.setDefaultTimeout(10000)
  restartedPage.on('pageerror', (error) => pageErrors.push(error.message))
  await restartedPage.waitForLoadState('domcontentloaded')
  await restartedPage.getByText('准备开始新的终端会话').waitFor()
  await restartedPage.waitForFunction(() =>
    document.documentElement.classList.contains('dark')
  )
  const restoredBrandSize = Number.parseFloat(
    await restartedPage
      .getByText('Claude Terminal', { exact: true })
      .evaluate((element) => getComputedStyle(element).fontSize)
  )
  assert.ok(restoredBrandSize > 16)
  assert.equal(
    (await restartedPage.locator('aside').innerText()).includes('Claude 1'),
    false
  )
  await restartedPage.screenshot({
    path: join(screenshots, '06-restart-persistence.png')
  })
  await restartedPage
    .evaluate(() => {
      window.location.href = 'https://example.invalid/navigation'
    })
    .catch(() => {})
  await restartedPage.waitForTimeout(300)
  assert.equal(restartedPage.url().startsWith('file:'), true)
  await electronApp
    .evaluate(() => globalThis.__CTD_TEST__.requestQuit())
    .catch(() => {})
  await waitFor(() => closed, 'persistence relaunch quit', 10000)

  assert.deepEqual(pageErrors, [])
  assert.equal(existsSync(join(artifactRoot, 'screenshots', '05-dark-workspace.png')), true)
  console.log(
    `E2E smoke passed${packagedExecutable ? ' (packaged)' : ''}: CSP and navigation guards, IPC page boundary, process guard, project/session buffering, two PTYs with unchanged PIDs, Claude descendant discovery, parallel layout, search, live settings, tray lifecycle, process-tree cleanup, restart persistence.`
  )
} catch (error) {
  if (electronApp && !closed) {
    await electronApp.close().catch(() => {})
  }
  console.error(error)
  process.exitCode = 1
}

