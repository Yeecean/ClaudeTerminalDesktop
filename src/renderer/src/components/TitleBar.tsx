import { Command } from 'lucide-react'
import type { Project, SessionRecord } from '../../../shared/types'

interface TitleBarProps {
  project?: Project
  session?: SessionRecord
}

export function TitleBar({ project, session }: TitleBarProps): React.JSX.Element {
  return (
    <header className="titlebar flex h-12 shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--app-bg)] px-4 pr-[148px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-[29px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--accent)] text-white shadow-[0_1px_3px_rgba(92,48,31,0.24)]">
          <Command size={15} strokeWidth={2.2} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold tracking-[-0.015em]">
            Claude Terminal
          </span>
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Desktop
          </span>
        </div>
      </div>

      {project ? (
        <div className="ml-5 flex min-w-0 items-center gap-2 border-l border-[var(--border-subtle)] pl-5">
          <span className="max-w-52 truncate text-[11.5px] font-medium text-[var(--text-secondary)]">
            {project.name}
          </span>
          {session ? (
            <>
              <span className="text-[var(--text-faint)]">/</span>
              <span className="max-w-56 truncate text-[11px] text-[var(--text-muted)]">
                {session.title}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
        <span className="size-1 rounded-full bg-[var(--success)]" />
        Local session
      </div>
    </header>
  )
}

