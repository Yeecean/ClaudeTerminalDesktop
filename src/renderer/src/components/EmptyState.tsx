import {
  AlertTriangle,
  ArrowRight,
  FolderPlus,
  History,
  Plus,
  TerminalSquare
} from 'lucide-react'
import type {
  EnvironmentDiagnostic,
  Project,
  SessionRecord
} from '../../../shared/types'
import { Button } from './ui/Button'

interface EmptyStateProps {
  project?: Project
  selectedSession?: SessionRecord
  diagnostics: EnvironmentDiagnostic
  hasProjects: boolean
  onAddProject: () => void
  onNewSession: () => void
  onContinueSession: () => void
  onResumeSession: () => void
}

const commands = [
  { command: 'claude', label: '新会话' },
  { command: 'claude -c', label: '继续最近' },
  { command: 'claude -r', label: '恢复历史' }
]

export function EmptyState({
  project,
  selectedSession,
  diagnostics,
  hasProjects,
  onAddProject,
  onNewSession,
  onContinueSession,
  onResumeSession
}: EmptyStateProps): React.JSX.Element {
  if (!hasProjects) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-[720px] overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--panel)] shadow-[0_1px_1px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col justify-center px-10 py-12">
              <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <FolderPlus size={20} strokeWidth={1.7} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Workspace
              </p>
              <h2 className="mt-2 text-[28px] font-semibold leading-[1.12] tracking-[-0.04em]">
                从一个项目开始
              </h2>
              <p className="mt-3 max-w-[360px] text-[12.5px] leading-5 text-[var(--text-muted)]">
                添加本地工作目录。应用会在这个目录里启动真实的 Claude Code CLI，
                并继续使用你现有的配置、Skills、MCP 与权限设置。
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button variant="primary" onClick={onAddProject}>
                  <FolderPlus size={15} strokeWidth={1.9} />
                  添加项目目录
                </Button>
                <span className="text-[10px] text-[var(--text-faint)]">支持 Windows 本地路径</span>
              </div>
            </div>
            <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--terminal-surface)] p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_32%,rgba(199,101,69,0.16),transparent_52%)]" />
              <div className="relative w-full max-w-[300px] rounded-xl border border-white/10 bg-[#24211d] p-4 shadow-[0_18px_50px_rgba(12,9,7,0.35)]">
                <div className="mb-4 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#df8b6c]" />
                  <span className="size-1.5 rounded-full bg-[#d6c6ab]/50" />
                  <span className="size-1.5 rounded-full bg-[#d6c6ab]/30" />
                  <span className="ml-auto font-mono text-[8px] uppercase tracking-widest text-white/25">
                    Claude CLI
                  </span>
                </div>
                <div className="space-y-2.5 font-mono text-[10.5px] leading-4 text-[#f2e9dc]/80">
                  <p>
                    <span className="text-[#df8b6c]">~/my-project</span>
                    <span className="text-white/35"> $</span> claude
                  </p>
                  <p className="text-[#a8c58c]">✓ reading project context</p>
                  <p className="text-white/45">ready for your next idea...</p>
                  <div className="flex items-center gap-1 pt-2 text-white/40">
                    <span className="h-3.5 w-[5px] animate-pulse bg-[#df8b6c]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <TerminalSquare className="mx-auto text-[var(--text-faint)]" size={26} strokeWidth={1.4} />
          <h2 className="mt-4 text-lg font-semibold">选择一个项目</h2>
          <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--text-muted)]">
            从左侧项目列表中选择工作目录，或新建一个 Claude Code 会话。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-[680px]">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--accent)]">
            <TerminalSquare size={23} strokeWidth={1.55} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              {project.name}
            </p>
            <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.035em]">
              {selectedSession?.status === 'exited' ? '这个会话已经结束' : '准备开始新的终端会话'}
            </h2>
            <p className="mt-2 max-w-[560px] truncate font-mono text-[10.5px] text-[var(--text-muted)]">
              {project.path}
            </p>
          </div>
        </div>

        {!diagnostics.cli.available ? (
          <div className="mt-6 flex gap-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3.5 py-3">
            <AlertTriangle
              size={15}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-[var(--warning-strong)]"
            />
            <div>
              <p className="text-[11.5px] font-semibold text-[var(--warning-strong)]">
                未检测到 Claude Code CLI
              </p>
              <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-secondary)]">
                仍可创建终端会话，但需要确认 `claude` 已安装并位于 PATH 中。
                应用不会自动安装或替换 CLI。
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Button variant="primary" onClick={onNewSession}>
            <Plus size={15} strokeWidth={2} />
            启动新会话
          </Button>
          <Button variant="secondary" onClick={onContinueSession}>
            <History size={14} strokeWidth={1.8} />
            继续最近会话
          </Button>
          <Button variant="ghost" onClick={onResumeSession}>
            恢复历史
            <ArrowRight size={13} strokeWidth={1.7} />
          </Button>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-2">
          {commands.map((item) => (
            <div
              key={item.command}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-2.5"
            >
              <p className="font-mono text-[10.5px] text-[var(--text-secondary)]">
                {item.command}
              </p>
              <p className="mt-1 text-[9.5px] text-[var(--text-faint)]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

