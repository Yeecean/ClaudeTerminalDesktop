import {
  Folder,
  PanelLeftClose,
  Plus,
  Settings2,
  TerminalSquare,
  Trash2
} from 'lucide-react'
import type {
  EnvironmentDiagnostic,
  Project,
  SessionRecord
} from '../../../shared/types'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

interface SidebarProps {
  projects: Project[]
  sessions: SessionRecord[]
  selectedProjectId: string | null
  selectedSessionId: string | null
  runtimeStartedAt: string
  diagnostics: EnvironmentDiagnostic
  onSelectProject: (projectId: string) => void
  onSelectSession: (session: SessionRecord) => void
  onAddProject: () => void
  onNewSession: (projectId: string) => void
  onRemoveProject: (project: Project) => void
  onOpenSettings: () => void
  onCloseSidebar: () => void
}

function statusLabel(status: SessionRecord['status']): string {
  if (status === 'running') return '运行中'
  if (status === 'starting') return '启动中'
  if (status === 'failed') return '启动失败'
  return '已结束'
}

function statusTone(status: SessionRecord['status']): string {
  if (status === 'running') return 'bg-[var(--success)]'
  if (status === 'starting') return 'bg-[var(--warning)] animate-pulse'
  if (status === 'failed') return 'bg-[var(--danger)]'
  return 'bg-[var(--text-faint)]'
}

export function Sidebar({
  projects,
  sessions,
  selectedProjectId,
  selectedSessionId,
  runtimeStartedAt,
  diagnostics,
  onSelectProject,
  onSelectSession,
  onAddProject,
  onNewSession,
  onRemoveProject,
  onOpenSettings,
  onCloseSidebar
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--sidebar-bg)]">
      <div className="flex h-12 items-center justify-between px-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            项目
          </span>
          <span className="rounded-full bg-[var(--hover-strong)] px-1.5 text-[9px] font-medium text-[var(--text-muted)]">
            {projects.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onAddProject}
            title="添加项目"
            aria-label="添加项目"
          >
            <Plus size={15} strokeWidth={1.9} />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onCloseSidebar}
            title="进入专注模式"
            aria-label="进入专注模式"
          >
            <PanelLeftClose size={14} strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {projects.length === 0 ? (
          <div className="mx-1 mt-6 rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-5 text-center">
            <Folder className="mx-auto text-[var(--text-faint)]" size={20} strokeWidth={1.5} />
            <p className="mt-2 text-[11.5px] font-medium text-[var(--text-secondary)]">
              还没有项目
            </p>
            <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-muted)]">
              添加一个工作目录开始使用
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          {projects.map((project) => {
            const projectSessions = sessions
              .filter((session) => session.projectId === project.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            const active = projectSessions.filter(
              (session) => session.status === 'running' || session.status === 'starting'
            )
            const ended = projectSessions
              .filter(
                (session) =>
                  (session.status === 'exited' || session.status === 'failed') &&
                  Boolean(session.endedAt && session.endedAt >= runtimeStartedAt)
              )
              .slice(-2)
            const visibleSessions = [...active, ...ended]
            const projectActive = project.id === selectedProjectId

            return (
              <div key={project.id} className="group/project">
                <div
                  className={cn(
                    'flex h-[var(--project-row-height)] items-center gap-1 rounded-lg px-1.5 transition-colors',
                    projectActive
                      ? 'bg-[var(--sidebar-selected)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Folder
                      size={13}
                      strokeWidth={1.8}
                      className={cn(
                        'shrink-0',
                        projectActive
                          ? 'text-[var(--accent)]'
                          : 'text-[var(--text-faint)]'
                      )}
                    />
                    <span className="truncate text-[11.5px] font-medium">{project.name}</span>
                    {active.length > 0 ? (
                      <span className="ml-auto text-[9px] tabular-nums text-[var(--text-faint)]">
                        {active.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    title="在此项目新建会话"
                    aria-label="在此项目新建会话"
                    onClick={() => onNewSession(project.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] opacity-0 outline-none transition hover:bg-[var(--hover-strong)] hover:text-[var(--text-secondary)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover/project:opacity-100"
                  >
                    <Plus size={13} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    title="移除项目"
                    aria-label="移除项目"
                    onClick={() => onRemoveProject(project)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] opacity-0 outline-none transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover/project:opacity-100"
                  >
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                </div>

                <div className="ml-[20px] mt-0.5 space-y-0.5 border-l border-[var(--border-subtle)] pl-2">
                  {visibleSessions.map((session) => {
                    const isSelected = session.id === selectedSessionId
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => onSelectSession(session)}
                        title={`${session.title} · ${statusLabel(session.status)}`}
                        className={cn(
                          'group/session flex h-[var(--session-row-height)] w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                          isSelected
                            ? 'bg-[var(--sidebar-selected-strong)] text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-secondary)]'
                        )}
                      >
                        <span
                          className={cn(
                            'size-[5px] shrink-0 rounded-full',
                            statusTone(session.status)
                          )}
                        />
                        <TerminalSquare
                          size={12}
                          strokeWidth={1.7}
                          className="shrink-0 text-[var(--text-faint)]"
                        />
                        <span className="truncate text-[10.5px] font-medium">
                          {session.title}
                        </span>
                        {session.status === 'exited' ? (
                          <span className="ml-auto text-[8.5px] uppercase tracking-wide text-[var(--text-faint)]">
                            结束
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                  {visibleSessions.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNewSession(project.id)}
                      className="flex h-[calc(var(--session-row-height)_-_2px)] w-full items-center gap-2 rounded-md px-2 text-left text-[10px] text-[var(--text-faint)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-muted)]"
                    >
                      <Plus size={11} />
                      新建终端会话
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] p-2.5">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-[var(--hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span
            className={cn(
              'size-[6px] shrink-0 rounded-full',
              diagnostics.cli.available
                ? 'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-soft)]'
                : 'bg-[var(--warning)] shadow-[0_0_0_3px_var(--warning-soft)]'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-medium text-[var(--text-secondary)]">
              {diagnostics.cli.available ? 'Claude Code 已就绪' : 'Claude Code 未找到'}
            </p>
            <p className="mt-0.5 truncate text-[9px] text-[var(--text-faint)]">
              {diagnostics.cli.version ?? diagnostics.cli.error ?? '等待环境诊断'}
            </p>
          </div>
          <Settings2 size={13} strokeWidth={1.7} className="text-[var(--text-faint)]" />
        </button>
      </div>
    </aside>
  )
}

