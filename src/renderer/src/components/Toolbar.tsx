import {
  Columns2,
  History,
  Moon,
  Monitor,
  PanelLeft,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Sun,
  Target
} from 'lucide-react'
import type {
  LayoutMode,
  Project,
  SessionRecord,
  ThemeMode
} from '../../../shared/types'
import { resolveDarkMode } from '../lib/theme'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import { Segmented } from './ui/Segmented'

interface ToolbarProps {
  project?: Project
  session?: SessionRecord
  layoutMode: LayoutMode
  themeMode: ThemeMode
  canLaunch: boolean
  onLayoutChange: (mode: LayoutMode) => void
  onThemeToggle: () => void
  onNewSession: () => void
  onContinueSession: () => void
  onResumeSession: () => void
  onEndSession: () => void
  onOpenSettings: () => void
}

function statusText(session?: SessionRecord): string {
  if (!session) return '无活动会话'
  if (session.status === 'starting') return '正在启动'
  if (session.status === 'running') return 'PTY 运行中'
  if (session.status === 'failed') return '启动失败'
  return '会话已结束'
}

export function Toolbar({
  project,
  session,
  layoutMode,
  themeMode,
  canLaunch,
  onLayoutChange,
  onThemeToggle,
  onNewSession,
  onContinueSession,
  onResumeSession,
  onEndSession,
  onOpenSettings
}: ToolbarProps): React.JSX.Element {
  const dark = resolveDarkMode(themeMode)

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--app-bg)] px-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--panel)] text-[var(--text-muted)]">
          <PanelLeft size={14} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">
              {project?.name ?? '未选择项目'}
            </span>
            {session ? (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium',
                  session.status === 'running'
                    ? 'bg-[var(--success-soft)] text-[var(--success-strong)]'
                    : session.status === 'starting'
                      ? 'bg-[var(--warning-soft)] text-[var(--warning-strong)]'
                      : session.status === 'failed'
                        ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                        : 'bg-[var(--hover-strong)] text-[var(--text-muted)]'
                )}
              >
                {statusText(session)}
              </span>
            ) : null}
          </div>
          <p className="max-w-[42vw] truncate text-[9.5px] text-[var(--text-faint)]">
            {project?.path ?? '添加一个工作目录以启动 Claude Code'}
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-2 xl:flex">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canLaunch}
          onClick={onContinueSession}
          title="在项目中继续最近一次 Claude Code 会话"
        >
          <History size={13} strokeWidth={1.8} />
          继续
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canLaunch}
          onClick={onResumeSession}
          title="打开 Claude Code 原生历史会话选择器"
        >
          <RotateCcw size={13} strokeWidth={1.8} />
          恢复
        </Button>
      </div>

      <Segmented
        value={layoutMode}
        onChange={onLayoutChange}
        options={[
          {
            value: 'focus',
            icon: <Target size={13} strokeWidth={1.8} />,
            title: '专注模式'
          },
          {
            value: 'navigation',
            icon: <PanelLeft size={13} strokeWidth={1.8} />,
            title: '导航模式'
          },
          {
            value: 'parallel',
            icon: <Columns2 size={13} strokeWidth={1.8} />,
            title: '并行模式'
          }
        ]}
      />

      <div className="flex items-center gap-1">
        {session?.status === 'running' || session?.status === 'starting' ? (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onEndSession}
            title="结束当前会话"
            aria-label="结束当前会话"
          >
            <Square size={13} strokeWidth={1.8} />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onThemeToggle}
          title={dark ? '切换到浅色主题' : '切换到深色主题'}
          aria-label="切换主题"
        >
          {themeMode === 'system' ? (
            <Monitor size={14} strokeWidth={1.7} />
          ) : dark ? (
            <Moon size={14} strokeWidth={1.7} />
          ) : (
            <Sun size={14} strokeWidth={1.7} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onOpenSettings}
          title="设置"
          aria-label="打开设置"
        >
          <Settings2 size={14} strokeWidth={1.7} />
        </Button>
      </div>

      <Button
        variant="primary"
        size="sm"
        disabled={!canLaunch}
        onClick={onNewSession}
        title="新建 Claude Code 会话"
        className="px-2.5"
      >
        <Plus size={14} strokeWidth={2.1} />
        <span className="hidden 2xl:inline">新会话</span>
      </Button>
    </div>
  )
}

