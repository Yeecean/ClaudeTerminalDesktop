import { AlertCircle, LoaderCircle, TerminalSquare } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import type {
  AppSettings,
  BootstrapPayload,
  EnvironmentDiagnostic,
  LayoutMode,
  Project,
  SessionLaunchMode,
  SessionRecord,
  SettingsPatch
} from '../../shared/types'
import { mergeSettings } from '../../shared/settings'
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog'
import { EmptyState } from './components/EmptyState'
import { SettingsSheet } from './components/SettingsSheet'
import { Sidebar } from './components/Sidebar'
import { TerminalWorkspace } from './components/TerminalWorkspace'
import { TitleBar } from './components/TitleBar'
import { Toast, type ToastMessage } from './components/Toast'
import { Toolbar } from './components/Toolbar'
import { Button } from './components/ui/Button'
import { applyGuiSettings, resolveDarkMode, systemPrefersDark } from './lib/theme'
import { errorMessage } from './lib/utils'

function activeStatus(session: SessionRecord): boolean {
  return session.status === 'running' || session.status === 'starting'
}

function initialProject(payload: BootstrapPayload): Project | undefined {
  return (
    payload.projects.find((project) =>
      payload.sessions.some(
        (session) => session.projectId === project.id && activeStatus(session)
      )
    ) ?? payload.projects[0]
  )
}

export function App(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostic | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [launching, setLaunching] = useState(false)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  const settingsRef = useRef<AppSettings | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRevisionRef = useRef(0)
  const terminalWriters = useRef(new Map<string, (data: string) => void>())
  const pendingTerminalData = useRef(new Map<string, string>())
  const launchingRef = useRef(false)
  const selectedProjectRef = useRef<string | null>(null)
  const runtimeStartedAtRef = useRef(new Date().toISOString())

  selectedProjectRef.current = selectedProjectId

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, tone })
    toastTimerRef.current = setTimeout(() => setToast(null), tone === 'error' ? 7000 : 3500)
  }, [])

  useEffect(() => {
    let mounted = true
    window.ctd
      .getBootstrap()
      .then((payload) => {
        if (!mounted) return
        setProjects(payload.projects)
        setSessions(payload.sessions)
        setSettings(payload.settings)
        settingsRef.current = payload.settings
        setDiagnostics(payload.diagnostics)
        const project = initialProject(payload)
        setSelectedProjectId(project?.id ?? null)
        const runningSession = project
          ? payload.sessions.find(
              (session) => session.projectId === project.id && activeStatus(session)
            )
          : undefined
        setSelectedSessionId(runningSession?.id ?? null)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setFatalError(errorMessage(error))
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const unsubscribeState = window.ctd.onStateChanged((event) => {
      setProjects(event.projects)
      setSessions(event.sessions)
    })
    const unsubscribeData = window.ctd.onPtyData((event) => {
      const writer = terminalWriters.current.get(event.sessionId)
      if (writer) {
        writer(event.data)
        return
      }
      const pending = pendingTerminalData.current.get(event.sessionId) ?? ''
      pendingTerminalData.current.set(
        event.sessionId,
        `${pending}${event.data}`.slice(-2 * 1024 * 1024)
      )
    })

    return () => {
      unsubscribeState()
      unsubscribeData()
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!settings) return
    const dark = resolveDarkMode(settings.themeMode)
    applyGuiSettings(settings, dark)
    void window.ctd.setWindowTheme({
      background: dark ? '#191714' : '#f3eee5',
      symbolColor: dark ? '#f1ebe1' : '#3a3129'
    })
  }, [settings, systemDark])

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null)
      setSelectedSessionId(null)
      return
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? null)
    }
    if (
      selectedSessionId &&
      !sessions.some((session) => session.id === selectedSessionId)
    ) {
      setSelectedSessionId(null)
    }
  }, [projects, sessions, selectedProjectId, selectedSessionId])

  useEffect(() => {
    if (selectedSessionId || !selectedProjectId) return
    const session = sessions.find(
      (item) => item.projectId === selectedProjectId && activeStatus(item)
    )
    if (session) setSelectedSessionId(session.id)
  }, [selectedProjectId, selectedSessionId, sessions])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const registerWriter = useCallback(
    (sessionId: string, writer: (data: string) => void): (() => void) => {
      terminalWriters.current.set(sessionId, writer)
      const pending = pendingTerminalData.current.get(sessionId)
      if (pending) {
        pendingTerminalData.current.delete(sessionId)
        writer(pending)
      }
      return () => {
        if (terminalWriters.current.get(sessionId) === writer) {
          terminalWriters.current.delete(sessionId)
        }
      }
    },
    []
  )

  const updateSettings = useCallback(
    (patch: SettingsPatch) => {
      if (!settingsRef.current) return
      const next = mergeSettings(settingsRef.current, patch)
      settingsRef.current = next
      setSettings(next)
      const revision = ++settingsRevisionRef.current
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const latest = settingsRef.current
        if (!latest) return
        void window.ctd
          .updateSettings(latest)
          .then((saved) => {
            if (revision !== settingsRevisionRef.current) return
            settingsRef.current = saved
            setSettings(saved)
          })
          .catch((error: unknown) => notify(errorMessage(error), 'error'))
      }, 90)
    },
    [notify]
  )

  const chooseProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId)
      const firstActive = sessions
        .filter((session) => session.projectId === projectId)
        .find(activeStatus)
      setSelectedSessionId(firstActive?.id ?? null)
    },
    [sessions]
  )

  const addProject = useCallback(async () => {
    try {
      const project = await window.ctd.addProject()
      if (!project) return
      setSelectedProjectId(project.id)
      setSelectedSessionId(null)
      notify(`已添加项目「${project.name}」。`)
    } catch (error) {
      notify(errorMessage(error), 'error')
    }
  }, [notify])

  const startSession = useCallback(
    async (projectId: string, mode: SessionLaunchMode) => {
      if (launchingRef.current) return
      launchingRef.current = true
      setLaunching(true)
      setSelectedProjectId(projectId)
      try {
        const result = await window.ctd.createSession({
          projectId,
          mode,
          cols: Math.max(70, Math.floor((window.innerWidth - 330) / 8.2)),
          rows: Math.max(20, Math.floor((window.innerHeight - 150) / 22))
        })
        setSessions((current) => {
          const exists = current.some((session) => session.id === result.session.id)
          return exists
            ? current.map((session) =>
                session.id === result.session.id ? result.session : session
              )
            : [...current, result.session]
        })
        setSelectedSessionId(result.session.id)
      } catch (error) {
        notify(errorMessage(error), 'error')
      } finally {
        launchingRef.current = false
        setLaunching(false)
      }
    },
    [notify]
  )

  const startSessionForActiveProject = useCallback(
    (mode: SessionLaunchMode) => {
      if (!selectedProjectRef.current) return
      void startSession(selectedProjectRef.current, mode)
    },
    [startSession]
  )

  const requestEndSession = useCallback(
    (session: SessionRecord) => {
      setConfirmRequest({
        title: '结束这个终端会话？',
        description: `「${session.title}」的 PTY 与子进程树会被终止。Claude Code 的历史仍由其原生会话机制管理。`,
        confirmLabel: '结束会话',
        danger: true,
        action: async () => {
          await window.ctd.endSession(session.id)
          notify('终端会话已结束。')
        }
      })
    },
    [notify]
  )

  const requestRemoveProject = useCallback(
    (project: Project) => {
      const activeCount = sessions.filter(
        (session) => session.projectId === project.id && activeStatus(session)
      ).length
      setConfirmRequest({
        title: '移除这个项目？',
        description:
          activeCount > 0
            ? `「${project.name}」有 ${activeCount} 个活动会话，移除前会结束这些 PTY 进程。项目目录本身不会被删除。`
            : `将从侧栏移除「${project.name}」及其应用内会话记录。项目目录本身不会被删除。`,
        confirmLabel: '移除项目',
        danger: true,
        action: async () => {
          await window.ctd.removeProject(project.id)
          if (selectedProjectRef.current === project.id) {
            setSelectedProjectId(null)
            setSelectedSessionId(null)
          }
          notify('项目已从工作区移除。')
        }
      })
    },
    [notify, sessions]
  )

  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const selectedSession = sessions.find((session) => session.id === selectedSessionId)
  const mountedSessions = sessions.filter(
    (session) => activeStatus(session) || session.id === selectedSessionId
  )
  const visibleIds = new Set<string>()

  if (settings?.layoutMode === 'parallel') {
    for (const session of mountedSessions) {
      if (activeStatus(session) && session.projectId === selectedProjectId) {
        visibleIds.add(session.id)
      }
    }
    if (selectedSessionId) visibleIds.add(selectedSessionId)
  } else if (selectedSessionId) {
    visibleIds.add(selectedSessionId)
  }

  const dark = settings ? resolveDarkMode(settings.themeMode) : systemDark
  const canLaunch = Boolean(selectedProjectId) && !launching

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.code === 'Comma') {
        event.preventDefault()
        setSettingsOpen(true)
        return
      }
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyN') {
        event.preventDefault()
        if (selectedProjectRef.current && !launchingRef.current) {
          void startSession(selectedProjectRef.current, 'new')
        }
        return
      }
      if (event.ctrlKey && !event.shiftKey && event.code === 'KeyB' && settings) {
        event.preventDefault()
        updateSettings({
          layoutMode: settings.layoutMode === 'focus' ? 'navigation' : 'focus'
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settings, startSession, updateSettings])

  if (loading || !settings || !diagnostics) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg">
            <TerminalSquare size={23} strokeWidth={1.6} />
            <span className="absolute -inset-1 rounded-[19px] border border-[var(--accent-border)]" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <LoaderCircle size={12} className="animate-spin" />
            正在读取本地工作区
          </div>
        </div>
      </div>
    )
  }

  if (fatalError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--app-bg)] p-8">
        <div className="max-w-md rounded-2xl border border-[var(--danger-border)] bg-[var(--panel-raised)] p-6">
          <AlertCircle className="text-[var(--danger)]" size={23} />
          <h1 className="mt-3 text-lg font-semibold">无法启动本地工作区</h1>
          <p className="mt-2 text-[11.5px] leading-5 text-[var(--text-muted)]">{fatalError}</p>
          <Button className="mt-5" variant="secondary" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    )
  }

  const showEmpty =
    visibleIds.size === 0 ||
    (!selectedSession && settings.layoutMode !== 'parallel')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <TitleBar project={selectedProject} session={selectedSession} />
      <div className="flex min-h-0 flex-1">
        {settings.layoutMode !== 'focus' ? (
          <Sidebar
            projects={projects}
            sessions={sessions}
            selectedProjectId={selectedProjectId}
            selectedSessionId={selectedSessionId}
            runtimeStartedAt={runtimeStartedAtRef.current}
            diagnostics={diagnostics}
            onSelectProject={chooseProject}
            onSelectSession={(session) => {
              setSelectedProjectId(session.projectId)
              setSelectedSessionId(session.id)
            }}
            onAddProject={() => void addProject()}
            onNewSession={(projectId) => void startSession(projectId, 'new')}
            onRemoveProject={requestRemoveProject}
            onOpenSettings={() => setSettingsOpen(true)}
            onCloseSidebar={() => updateSettings({ layoutMode: 'focus' })}
          />
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
          <Toolbar
            project={selectedProject}
            session={selectedSession}
            layoutMode={settings.layoutMode}
            themeMode={settings.themeMode}
            canLaunch={canLaunch}
            onLayoutChange={(layoutMode: LayoutMode) => {
              updateSettings({ layoutMode })
              if (layoutMode === 'parallel' && !selectedSessionId) {
                const firstActive = mountedSessions.find(
                  (session) => activeStatus(session) && session.projectId === selectedProjectId
                )
                if (firstActive) setSelectedSessionId(firstActive.id)
              }
            }}
            onThemeToggle={() =>
              updateSettings({ themeMode: dark ? 'light' : 'dark' })
            }
            onNewSession={() => startSessionForActiveProject('new')}
            onContinueSession={() => startSessionForActiveProject('continue')}
            onResumeSession={() => startSessionForActiveProject('resume')}
            onEndSession={() => {
              if (selectedSession) requestEndSession(selectedSession)
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {showEmpty ? (
            <EmptyState
              project={selectedProject}
              selectedSession={selectedSession}
              diagnostics={diagnostics}
              hasProjects={projects.length > 0}
              onAddProject={() => void addProject()}
              onNewSession={() => startSessionForActiveProject('new')}
              onContinueSession={() => startSessionForActiveProject('continue')}
              onResumeSession={() => startSessionForActiveProject('resume')}
            />
          ) : (
            <TerminalWorkspace
              sessions={mountedSessions}
              visibleIds={visibleIds}
              projects={projects}
              settings={settings}
              layoutMode={settings.layoutMode}
              registerWriter={registerWriter}
              onError={(message) => notify(message, 'error')}
              onEndSession={requestEndSession}
            />
          )}
        </main>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        diagnostics={diagnostics}
        onPatch={updateSettings}
        onRequestQuit={() => {
          void window.ctd.requestQuit().catch((error: unknown) => {
            notify(errorMessage(error), 'error')
          })
        }}
      />
      <ConfirmDialog
        request={confirmRequest}
        onOpenChange={(open) => {
          if (!open) setConfirmRequest(null)
        }}
        onConfirmed={() => setConfirmRequest(null)}
      />
      <Toast toast={toast} />
    </div>
  )
}

