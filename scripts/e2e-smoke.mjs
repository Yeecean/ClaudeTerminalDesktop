import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const projectPath = process.cwd()
const artifactRoot = resolve(projectPath, 'test-results', 'e2e')
const userDataPath = join(artifactRoot, 'user-data')
const screenshots = join(artifactRoot, 'screenshots')
const packagedExecutable = process.env.CTD_E2E_EXECUTABLE
  ? resolve(process.env.CTD_E2E_EXECUTABLE)
  : null

rmSync(artifactRoot, { recursive: true, force: true })
mkdirSync(screenshots, { recursive: true })

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const environment = {
  ...process.env,
  CTD_E2E: '1',
  CTD_USER_DATA_DIR: userDataPath
}

function launchApplication() {
  if (packagedExecutable) {
    return electron.launch({
      executablePath: packagedExecutable,
      env: environment
    })
  }
  return electron.launch({
    args: ['.'],
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
  await page.screenshot({ path: join(screenshots, '02-claude-cli.png') })

  await page.keyboard.press('Control+Shift+N')
  await waitFor(async () => (await activeCount()) === 2, 'second PTY')
  await page.locator('aside button[title^="Claude 1"]').click()
  assert.equal(await activeCount(), 2)
  await page.getByTitle('并行模式').click()
  await page.waitForTimeout(400)
  assert.equal(await page.locator('.terminal-host:visible').count(), 2)
  await page.screenshot({ path: join(screenshots, '02b-parallel-mode.png') })
  await page.getByTitle('导航模式').click()
  await page.locator('.xterm').first().click()
  await page.keyboard.press('Control+f')
  const searchInput = page.getByPlaceholder('在终端中查找')
  await searchInput.waitFor()
  await searchInput.press('Escape')
  await page.getByPlaceholder('在终端中查找').waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: '打开设置' }).click()
  await page.getByRole('button', { name: '深色' }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

  const brand = page.getByText('Claude Terminal', { exact: true })
  const sizeBefore = Number.parseFloat(
    await brand.evaluate((element) => getComputedStyle(element).fontSize)
  )
  const guiSizeSlider = page.locator('input[type=range]').first()
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

  const persisted = JSON.parse(readFileSync(join(userDataPath, 'settings.json'), 'utf8'))
  assert.equal(persisted.themeMode, 'dark')
  assert.equal(persisted.gui.fontSize, 20)
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
  await electronApp.evaluate(({ app }) => {
    setTimeout(() => app.quit(), 0)
  })
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
  await electronApp.evaluate(({ app }) => {
    setTimeout(() => app.quit(), 0)
  })
  await waitFor(() => closed, 'persistence relaunch quit', 10000)

  assert.deepEqual(pageErrors, [])
  assert.equal(existsSync(join(artifactRoot, 'screenshots', '05-dark-workspace.png')), true)
  console.log(
    `E2E smoke passed${packagedExecutable ? ' (packaged)' : ''}: project, two PTYs, Claude descendant discovery, parallel layout, session switch, search, live settings, tray hide/restore, process-tree cleanup, restart persistence.`
  )
} catch (error) {
  if (electronApp && !closed) {
    await electronApp.close().catch(() => {})
  }
  console.error(error)
  process.exitCode = 1
}

