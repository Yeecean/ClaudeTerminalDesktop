import { Square, TerminalSquare } from 'lucide-react'
import type {
  AppSettings,
  LayoutMode,
  Project,
  SessionRecord
} from '../../../shared/types'
import { cn } from '../lib/utils'
import { TerminalPane } from './TerminalPane'

interface TerminalWorkspaceProps {
  sessions: SessionRecord[]
  visibleIds: Set<string>
  projects: Project[]
  settings: AppSettings
  layoutMode: LayoutMode
  registerWriter: (sessionId: string, writer: (data: string) => void) => () => void
  onError: (message: string) => void
  onEndSession: (session: SessionRecord) => void
}

export function TerminalWorkspace({
  sessions,
  visibleIds,
  projects,
  settings,
  layoutMode,
  registerWriter,
  onError,
  onEndSession
}: TerminalWorkspaceProps): React.JSX.Element {
  const parallel = layoutMode === 'parallel'
  const projectById = new Map(projects.map((project) => [project.id, project]))

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 gap-2.5 overflow-x-auto bg-[var(--workspace-bg)]',
        parallel ? 'p-2.5' : 'p-3'
      )}
    >
      {sessions.map((session) => {
        const visible = visibleIds.has(session.id)
        const project = projectById.get(session.projectId)
        const active = session.status === 'running' || session.status === 'starting'
        return (
          <div
            key={session.id}
            className={cn(
              'min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
              parallel
                ? 'flex min-w-[420px] rounded-xl border border-[var(--border)] bg-[var(--terminal-surface)] shadow-sm'
                : 'rounded-[14px] border border-[var(--border)] bg-[var(--terminal-surface)] shadow-[0_1px_2px_rgba(25,18,12,0.06)]',
              visible ? 'flex' : 'hidden'
            )}
          >
            {parallel ? (
              <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-white/10 bg-[#292520] px-3 text-white/70">
                <TerminalSquare size={12} strokeWidth={1.7} />
                <span className="truncate text-[10.5px] font-medium">{session.title}</span>
                <span className="text-[9px] text-white/30">{project?.name}</span>
                <span
                  className={cn(
                    'ml-auto size-1.5 rounded-full',
                    active ? 'bg-[#7fb98a]' : 'bg-white/25'
                  )}
                />
                {active ? (
                  <button
                    type="button"
                    title="结束会话"
                    aria-label="结束会话"
                    onClick={() => onEndSession(session)}
                    className="ml-1 flex size-6 items-center justify-center rounded-md text-white/35 outline-none transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <Square size={10} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            ) : null}
            <TerminalPane
              sessionId={session.id}
              settings={settings}
              visible={visible}
              registerWriter={registerWriter}
              onError={onError}
            />
          </div>
        )
      })}
    </div>
  )
}

