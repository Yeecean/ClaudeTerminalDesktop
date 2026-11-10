import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AppStore } from '../../src/main/store'

const roots: string[] = []
const stores: AppStore[] = []

function createLayout(): {
  root: string
  dataDir: string
  projectDir: string
} {
  const root = mkdtempSync(join(tmpdir(), 'ctd-store-'))
  const dataDir = join(root, 'appdata')
  const projectDir = join(root, 'project')
  mkdirSync(projectDir, { recursive: true })
  roots.push(root)
  return { root, dataDir, projectDir }
}

function createStore(dataDir: string): AppStore {
  const store = new AppStore(dataDir)
  stores.push(store)
  return store
}

afterEach(() => {
  for (const store of stores.splice(0)) store.shutdown()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('AppStore', () => {
  it('adds, deduplicates, persists, and removes projects', () => {
    const { dataDir, projectDir } = createLayout()
    const store = createStore(dataDir)
    const project = store.addProject(projectDir)
    const duplicate = store.addProject(projectDir)

    expect(duplicate.id).toBe(project.id)
    expect(store.getProjects()).toHaveLength(1)
    expect(store.getProjects()[0]?.path.toLowerCase()).toBe(projectDir.toLowerCase())

    store.flush()
    const reopened = createStore(dataDir)
    expect(reopened.getProjects()).toHaveLength(1)

    expect(reopened.removeProject(project.id)).toEqual([])
    expect(reopened.getProjects()).toHaveLength(0)
  })

  it('persists settings atomically and restores them', () => {
    const { dataDir } = createLayout()
    const store = createStore(dataDir)
    store.updateSettings({
      themeMode: 'dark',
      gui: { fontSize: 18 },
      terminal: { fontFamily: 'Consolas', fontSize: 16 }
    })
    store.flush()

    const file = join(dataDir, 'settings.json')
    expect(existsSync(file)).toBe(true)
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
      themeMode: string
      gui: { fontSize: number }
    }
    expect(parsed.themeMode).toBe('dark')
    expect(parsed.gui.fontSize).toBe(18)

    const reopened = createStore(dataDir)
    expect(reopened.getSettings().themeMode).toBe('dark')
    expect(reopened.getSettings().terminal.fontFamily).toBe('Consolas')
    expect(readdirSync(dataDir).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('marks sessions left running by a previous process as exited', () => {
    const { dataDir, projectDir } = createLayout()
    const store = createStore(dataDir)
    const project = store.addProject(projectDir)
    const session = store.createSession(project.id, 'Claude 1')
    store.updateSession(session.id, { status: 'running' })
    store.flush()

    const reopened = createStore(dataDir)
    const restored = reopened.getSession(session.id)
    expect(restored?.status).toBe('exited')
    expect(restored?.endedAt).toBeTruthy()
  })

  it('backs up corrupt JSON and falls back to usable defaults', () => {
    const { dataDir } = createLayout()
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'settings.json'), '{broken', 'utf8')

    const store = createStore(dataDir)
    expect(store.getSettings().version).toBe(1)
    expect(store.getProjects()).toEqual([])
    expect(
      readdirSync(dataDir).some((name) => name.startsWith('settings.json.corrupt-'))
    ).toBe(true)
  })

  it('rejects missing or non-directory project paths', () => {
    const { dataDir, root } = createLayout()
    const store = createStore(dataDir)
    expect(() => store.addProject(join(root, 'missing'))).toThrow('有效目录')

    const filePath = join(root, 'file.txt')
    writeFileSync(filePath, 'x')
    expect(() => store.addProject(filePath)).toThrow('有效目录')
  })
})

