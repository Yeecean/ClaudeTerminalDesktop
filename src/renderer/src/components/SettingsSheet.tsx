import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Check,
  ChevronRight,
  Cpu,
  Moon,
  Monitor,
  Palette,
  Power,
  Sparkles,
  Sun,
  SquareTerminal,
  SwatchBook,
  X
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type {
  AppSettings,
  EnvironmentDiagnostic,
  SettingsPatch
} from '../../../shared/types'
import { cn } from '../lib/utils'
import { Segmented } from './ui/Segmented'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from './ui/Dialog'
import { Switch } from './ui/Switch'

type TabId = 'appearance' | 'terminal' | 'colors' | 'shell' | 'environment'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AppSettings
  diagnostics: EnvironmentDiagnostic
  onPatch: (patch: SettingsPatch) => void
  onRequestQuit: () => void
}

const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: '外观', icon: <Sparkles size={13} strokeWidth={1.7} /> },
  { id: 'terminal', label: '终端', icon: <SquareTerminal size={13} strokeWidth={1.7} /> },
  { id: 'colors', label: '配色', icon: <SwatchBook size={13} strokeWidth={1.7} /> },
  { id: 'shell', label: 'Shell', icon: <ChevronRight size={13} strokeWidth={1.7} /> },
  { id: 'environment', label: '诊断', icon: <Cpu size={13} strokeWidth={1.7} /> }
]

const fontPresets = [
  'Cascadia Code',
  'Cascadia Mono',
  'JetBrains Mono',
  'Consolas',
  'Maple Mono',
  'Sarasa Mono SC',
  '更纱黑体',
  'Microsoft YaHei UI',
  'Segoe UI Variable',
  'Segoe UI'
]

const ansiLabels = [
  '黑',
  '红',
  '绿',
  '黄',
  '蓝',
  '洋红',
  '青',
  '白',
  '亮黑',
  '亮红',
  '亮绿',
  '亮黄',
  '亮蓝',
  '亮洋红',
  '亮青',
  '亮白'
]

const inputClass =
  'h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] px-2.5 text-[11.5px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--focus-ring)]'

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b border-[var(--border-subtle)] px-5 py-5 last:border-0">
      <div className="mb-4">
        <h3 className="text-[12px] font-semibold tracking-[-0.01em]">{title}</h3>
        {description ? (
          <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</p>
        {hint ? <p className="mt-0.5 text-[9.5px] text-[var(--text-faint)]">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function StackField({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div>
      <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</p>
      {hint ? <p className="mt-0.5 text-[9.5px] leading-4 text-[var(--text-faint)]">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  )
}

function DraftInput({
  value,
  placeholder,
  onCommit
}: {
  value: string
  placeholder?: string
  onCommit: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = (): void => {
    const next = draft.trim()
    if (next !== value) onCommit(next)
    else setDraft(value)
  }

  return (
    <input
      value={draft}
      spellCheck={false}
      placeholder={placeholder}
      className={inputClass}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</p>
        <span className="min-w-12 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
          {value}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-control mt-2 w-full"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9.5px] text-[var(--text-faint)]">
          {value.toUpperCase()}
        </span>
        <label
          className="relative size-7 cursor-pointer overflow-hidden rounded-md border border-[var(--border-strong)] shadow-inner"
          style={{ backgroundColor: value }}
          title={`选择${label}颜色`}
        >
          <input
            type="color"
            value={value.slice(0, 7)}
            aria-label={`${label}颜色`}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

function TerminalPreview({ settings }: { settings: AppSettings }): React.JSX.Element {
  const terminal = settings.terminal
  const keyStyle = { color: terminal.ansi[3] }
  const okStyle = { color: terminal.ansi[2] }
  const promptStyle = { color: terminal.ansi[12] }

  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--border)]"
      style={{ backgroundColor: terminal.background }}
    >
      <div className="flex h-7 items-center gap-1.5 border-b border-white/10 px-3">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: terminal.ansi[1] }} />
        <span className="size-1.5 rounded-full" style={{ backgroundColor: terminal.ansi[3] }} />
        <span className="size-1.5 rounded-full" style={{ backgroundColor: terminal.ansi[2] }} />
        <span className="ml-2 text-[8px] uppercase tracking-[0.15em] text-white/30">
          Terminal preview
        </span>
      </div>
      <div
        className="space-y-1.5 overflow-hidden px-4 py-3"
        style={{
          color: terminal.foreground,
          fontFamily: terminal.fontFamily,
          fontSize: `${Math.min(terminal.fontSize, 15)}px`,
          fontWeight: terminal.fontWeight,
          lineHeight: terminal.lineHeight
        }}
      >
        <p>
          <span style={promptStyle}>~/project</span>
          <span className="opacity-45"> $ </span>
          claude
        </p>
        <p style={okStyle}>✓ context loaded</p>
        <p>
          <span style={keyStyle}>model</span>
          <span className="opacity-45"> · </span>
          claude-sonnet
        </p>
        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-white/45">&gt;</span>
          <span
            className="inline-block h-[1.1em] w-[5px]"
            style={{
              backgroundColor: terminal.cursorColor,
              opacity: terminal.cursorBlink ? 0.9 : 1
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function SettingsSheet({
  open,
  onOpenChange,
  settings,
  diagnostics,
  onPatch,
  onRequestQuit
}: SettingsSheetProps): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('appearance')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" showClose={false} className="gap-0">
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 pr-14">
          <div>
            <DialogTitle>设置</DialogTitle>
            <DialogDescription className="mt-0.5">
              更改会即时应用，并安全保存在本地
            </DialogDescription>
          </div>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="关闭设置"
          >
            <X size={16} strokeWidth={1.8} />
          </DialogPrimitive.Close>
        </div>

        <div className="flex h-[50px] shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-4">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                tab === item.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-secondary)]'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'appearance' ? (
            <>
              <Section title="界面主题" description="选择 GUI 的显示方式；终端配色可独立设置。">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light' as const, label: '浅色', icon: <Sun size={13} /> },
                    { value: 'dark' as const, label: '深色', icon: <Moon size={13} /> },
                    { value: 'system' as const, label: '跟随系统', icon: <Monitor size={13} /> }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onPatch({ themeMode: option.value })}
                      className={cn(
                        'relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                        settings.themeMode === option.value
                          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                          : 'border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--hover)]'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-full overflow-hidden rounded-md border border-black/10',
                          option.value === 'dark'
                            ? 'bg-[#1c1a17]'
                            : option.value === 'light'
                              ? 'bg-[#f5f0e7]'
                              : 'bg-gradient-to-r from-[#f5f0e7] to-[#1c1a17]'
                        )}
                      >
                        <div
                          className={cn(
                            'h-full w-[30%] border-r',
                            option.value === 'dark'
                              ? 'border-white/10 bg-[#26221e]'
                              : 'border-black/10 bg-[#ece6db]'
                          )}
                        />
                        <div className="flex flex-1 items-center px-2">
                          <span
                            className={cn(
                              'h-1 w-8 rounded-full',
                              option.value === 'dark' ? 'bg-white/25' : 'bg-black/15'
                            )}
                          />
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10.5px] font-medium">
                        {option.icon}
                        {option.label}
                      </span>
                      {settings.themeMode === option.value ? (
                        <Check
                          size={12}
                          strokeWidth={2.2}
                          className="absolute right-2.5 top-2.5 text-[var(--accent-strong)]"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="界面字体" description="只影响侧栏、工具栏和设置界面。">
                <StackField label="字体族">
                  <DraftInput
                    value={settings.gui.fontFamily}
                    placeholder="Segoe UI Variable"
                    onCommit={(fontFamily) => onPatch({ gui: { fontFamily } })}
                  />
                </StackField>
                <RangeField
                  label="字号"
                  value={settings.gui.fontSize}
                  min={13}
                  max={20}
                  step={1}
                  unit="px"
                  onChange={(fontSize) => onPatch({ gui: { fontSize } })}
                />
                <Field label="字体粗细">
                  <select
                    value={settings.gui.fontWeight}
                    onChange={(event) =>
                      onPatch({ gui: { fontWeight: Number(event.target.value) } })
                    }
                    className={cn(inputClass, 'w-32')}
                  >
                    <option value={300}>300 Light</option>
                    <option value={400}>400 Regular</option>
                    <option value={500}>500 Medium</option>
                    <option value={600}>600 Semibold</option>
                  </select>
                </Field>
                <Field label="界面密度">
                  <Segmented
                    value={settings.gui.density}
                    options={[
                      { value: 'compact', label: '紧凑' },
                      { value: 'comfortable', label: '标准' }
                    ]}
                    onChange={(density) => onPatch({ gui: { density } })}
                  />
                </Field>
              </Section>

              <Section title="布局" description="布局也会同步到顶部工具栏。">
                <Field label="默认布局">
                  <Segmented
                    value={settings.layoutMode}
                    options={[
                      { value: 'focus', label: '专注' },
                      { value: 'navigation', label: '导航' },
                      { value: 'parallel', label: '并行' }
                    ]}
                    onChange={(layoutMode) => onPatch({ layoutMode })}
                  />
                </Field>
              </Section>

              <Section title="窗口行为">
                <Field
                  label="关闭窗口时隐藏到托盘"
                  hint="终端与 Claude Code 进程会继续在后台运行"
                >
                  <Switch
                    checked={settings.window.hideOnClose}
                    onCheckedChange={(hideOnClose) =>
                      onPatch({ window: { hideOnClose } })
                    }
                    label="关闭窗口时隐藏到托盘"
                  />
                </Field>
              </Section>
            </>
          ) : null}

          {tab === 'terminal' ? (
            <>
              <Section
                title="实时预览"
                description="终端字体与配色仅影响 xterm 渲染，不会改写 CLI 自身输出。"
              >
                <TerminalPreview settings={settings} />
              </Section>

              <Section title="终端字体">
                <StackField
                  label="字体族"
                  hint="可输入逗号分隔的字体回退链，按 Enter 或失焦应用。"
                >
                  <DraftInput
                    value={settings.terminal.fontFamily}
                    placeholder="Cascadia Code, Consolas, monospace"
                    onCommit={(fontFamily) => onPatch({ terminal: { fontFamily } })}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {fontPresets.map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => onPatch({ terminal: { fontFamily: font } })}
                        className="rounded-md border border-[var(--border-subtle)] px-1.5 py-1 text-[8.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-secondary)]"
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                </StackField>
                <RangeField
                  label="字号"
                  value={settings.terminal.fontSize}
                  min={9}
                  max={32}
                  step={1}
                  unit="px"
                  onChange={(fontSize) => onPatch({ terminal: { fontSize } })}
                />
                <RangeField
                  label="行高"
                  value={settings.terminal.lineHeight}
                  min={0.8}
                  max={2.2}
                  step={0.05}
                  onChange={(lineHeight) => onPatch({ terminal: { lineHeight } })}
                />
                <Field label="常规字重">
                  <select
                    value={settings.terminal.fontWeight}
                    onChange={(event) =>
                      onPatch({ terminal: { fontWeight: Number(event.target.value) } })
                    }
                    className={cn(inputClass, 'w-32')}
                  >
                    <option value={300}>300</option>
                    <option value={400}>400</option>
                    <option value={500}>500</option>
                    <option value={600}>600</option>
                  </select>
                </Field>
                <Field label="粗体字重">
                  <select
                    value={settings.terminal.fontWeightBold}
                    onChange={(event) =>
                      onPatch({ terminal: { fontWeightBold: Number(event.target.value) } })
                    }
                    className={cn(inputClass, 'w-28')}
                  >
                    <option value={500}>500</option>
                    <option value={600}>600</option>
                    <option value={700}>700</option>
                    <option value={800}>800</option>
                  </select>
                </Field>
              </Section>

              <Section title="光标与滚动">
                <Field label="光标样式">
                  <Segmented
                    value={settings.terminal.cursorStyle}
                    options={[
                      { value: 'bar', label: '竖线' },
                      { value: 'block', label: '方块' },
                      { value: 'underline', label: '下划线' }
                    ]}
                    onChange={(cursorStyle) => onPatch({ terminal: { cursorStyle } })}
                  />
                </Field>
                <Field label="光标闪烁">
                  <Switch
                    checked={settings.terminal.cursorBlink}
                    onCheckedChange={(cursorBlink) => onPatch({ terminal: { cursorBlink } })}
                    label="光标闪烁"
                  />
                </Field>
                <RangeField
                  label="滚动缓冲"
                  value={settings.terminal.scrollback}
                  min={1000}
                  max={50000}
                  step={1000}
                  unit=" 行"
                  onChange={(scrollback) => onPatch({ terminal: { scrollback } })}
                />
                <RangeField
                  label="滚动速度"
                  value={settings.terminal.scrollSensitivity}
                  min={0.25}
                  max={5}
                  step={0.05}
                  unit="×"
                  onChange={(scrollSensitivity) =>
                    onPatch({ terminal: { scrollSensitivity } })
                  }
                />
                <RangeField
                  label="终端内边距"
                  value={settings.terminal.padding}
                  min={0}
                  max={32}
                  step={1}
                  unit="px"
                  onChange={(padding) => onPatch({ terminal: { padding } })}
                />
              </Section>
            </>
          ) : null}

          {tab === 'colors' ? (
            <>
              <Section title="终端基础色">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <ColorField
                    label="背景"
                    value={settings.terminal.background}
                    onChange={(background) => onPatch({ terminal: { background } })}
                  />
                  <ColorField
                    label="前景"
                    value={settings.terminal.foreground}
                    onChange={(foreground) => onPatch({ terminal: { foreground } })}
                  />
                  <ColorField
                    label="光标"
                    value={settings.terminal.cursorColor}
                    onChange={(cursorColor) => onPatch({ terminal: { cursorColor } })}
                  />
                  <ColorField
                    label="选区"
                    value={settings.terminal.selectionBackground}
                    onChange={(selectionBackground) =>
                      onPatch({ terminal: { selectionBackground } })
                    }
                  />
                </div>
              </Section>
              <Section
                title="ANSI 调色板"
                description="CLI 可覆盖个别颜色；此处控制模拟器能解析的标准 16 色。"
              >
                <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                  {ansiLabels.map((label, index) => (
                    <ColorField
                      key={label}
                      label={label}
                      value={settings.terminal.ansi[index] ?? '#000000'}
                      onChange={(color) => {
                        const ansi = [...settings.terminal.ansi]
                        ansi[index] = color
                        onPatch({ terminal: { ansi } })
                      }}
                    />
                  ))}
                </div>
              </Section>
              <Section title="预览">
                <TerminalPreview settings={settings} />
              </Section>
            </>
          ) : null}

          {tab === 'shell' ? (
            <>
              <Section
                title="PowerShell"
                description="Shell 与 Profile 设置应用于之后新建的会话，不会重启现有终端。"
              >
                <div className="space-y-1.5">
                  {diagnostics.shells
                    .filter((shell) => shell.kind !== 'custom')
                    .map((shell) => (
                      <button
                        key={shell.kind}
                        type="button"
                        disabled={!shell.available}
                        onClick={() => onPatch({ shell: { kind: shell.kind } })}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45',
                          settings.shell.kind === shell.kind
                            ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                            : 'border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--hover)]'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium">{shell.label}</p>
                          <p className="mt-1 break-all font-mono text-[9px] leading-4 text-[var(--text-faint)]">
                            {shell.path ?? '未找到'}
                          </p>
                        </div>
                        {settings.shell.kind === shell.kind ? (
                          <Check
                            size={13}
                            strokeWidth={2.2}
                            className="mt-0.5 shrink-0 text-[var(--accent-strong)]"
                          />
                        ) : null}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => onPatch({ shell: { kind: 'custom' } })}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                      settings.shell.kind === 'custom'
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--hover)]'
                    )}
                  >
                    <div>
                      <p className="text-[11.5px] font-medium">自定义 PowerShell 路径</p>
                      <p className="mt-1 text-[9px] text-[var(--text-faint)]">
                        仅支持 PowerShell / pwsh 兼容参数
                      </p>
                    </div>
                    {settings.shell.kind === 'custom' ? (
                      <Check
                        size={13}
                        strokeWidth={2.2}
                        className="shrink-0 text-[var(--accent-strong)]"
                      />
                    ) : null}
                  </button>
                </div>
                {settings.shell.kind === 'custom' ? (
                  <StackField label="可执行文件路径">
                    <DraftInput
                      value={settings.shell.customPath}
                      placeholder="C:\\Program Files\\PowerShell\\7\\pwsh.exe"
                      onCommit={(customPath) => onPatch({ shell: { customPath } })}
                    />
                  </StackField>
                ) : null}
                <Field
                  label="加载用户 Profile"
                  hint="关闭可用于排查阻塞 CLI 启动的 Profile"
                >
                  <Switch
                    checked={settings.shell.loadProfile}
                    onCheckedChange={(loadProfile) => onPatch({ shell: { loadProfile } })}
                    label="加载用户 Profile"
                  />
                </Field>
              </Section>
              <Section title="环境继承">
                <p className="text-[10.5px] leading-5 text-[var(--text-muted)]">
                  应用继承 Electron 主进程的 PATH、SystemRoot、USERPROFILE 与现有网关环境变量。
                  不设置或覆盖 <span className="font-mono text-[10px]">CLAUDE_CONFIG_DIR</span>，
                  不复制或修改 Claude 配置。
                </p>
              </Section>
            </>
          ) : null}

          {tab === 'environment' ? (
            <>
              <Section title="Claude Code">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          diagnostics.cli.available
                            ? 'bg-[var(--success)]'
                            : 'bg-[var(--warning)]'
                        )}
                      />
                      <p className="text-[11.5px] font-medium">
                        {diagnostics.cli.available ? 'CLI 可用' : 'CLI 不可用'}
                      </p>
                    </div>
                    <span className="font-mono text-[9.5px] text-[var(--text-muted)]">
                      {diagnostics.cli.version ?? 'unknown'}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-[9px] leading-4 text-[var(--text-faint)]">
                    {diagnostics.cli.path ?? diagnostics.cli.error}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 font-mono text-[9px] text-[var(--text-muted)]">
                    claude --version
                  </span>
                  <span className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 font-mono text-[9px] text-[var(--text-muted)]">
                    claude doctor
                  </span>
                </div>
              </Section>
              <Section title="PowerShell 检测">
                <div className="space-y-2">
                  {diagnostics.shells.map((shell) => (
                    <div
                      key={shell.kind}
                      className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-medium">{shell.label}</p>
                        <p className="mt-0.5 break-all font-mono text-[9px] text-[var(--text-faint)]">
                          {shell.path ?? '未找到'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-[9px] font-medium',
                          shell.available
                            ? 'text-[var(--success-strong)]'
                            : 'text-[var(--text-faint)]'
                        )}
                      >
                        {shell.available ? '可用' : '不可用'}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="运行环境">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['应用', diagnostics.appVersion],
                    ['Electron', diagnostics.electronVersion],
                    ['Node.js', diagnostics.nodeVersion],
                    ['Windows', diagnostics.osVersion]
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--panel)] px-2.5 py-2"
                    >
                      <p className="text-[8.5px] uppercase tracking-wide text-[var(--text-faint)]">
                        {label}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9.5px] text-[var(--text-secondary)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--panel)] px-2.5 py-2">
                  <div>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      进程级联保护
                    </p>
                    <p className="mt-0.5 text-[9px] text-[var(--text-faint)]">
                      Windows Job Object，异常退出时终止终端进程树
                    </p>
                    {!diagnostics.jobGuardActive && diagnostics.jobGuardError ? (
                      <p className="mt-1 max-w-[360px] break-all text-[8.5px] leading-3 text-[var(--warning-strong)]">
                        {diagnostics.jobGuardError}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-medium',
                      diagnostics.jobGuardActive
                        ? 'text-[var(--success-strong)]'
                        : 'text-[var(--warning-strong)]'
                    )}
                  >
                    {diagnostics.jobGuardActive ? '已启用' : '不可用'}
                  </span>
                </div>
              </Section>
              <Section title="配置与隐私">
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-[10px] leading-4',
                    diagnostics.configDirInherited
                      ? 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--text-secondary)]'
                      : 'border-[var(--border)] bg-[var(--panel)] text-[var(--text-muted)]'
                  )}
                >
                  {diagnostics.configDirInherited
                    ? '检测到已存在的 CLAUDE_CONFIG_DIR。应用会原样继承该环境，不会修改或覆盖。'
                    : '未检测到 CLAUDE_CONFIG_DIR。应用不创建独立 Claude Profile。'}
                  <p className="mt-1">
                    不保存 API Key、Token、完整对话、终端日志或环境变量值。
                  </p>
                </div>
              </Section>
            </>
          ) : null}
        </div>

        <div className="flex h-11 shrink-0 items-center border-t border-[var(--border-subtle)] bg-[var(--panel)] px-5">
          <span className="flex items-center gap-1.5 text-[9.5px] text-[var(--text-faint)]">
            <Check size={11} strokeWidth={2} />
            自动保存
          </span>
          <button
            type="button"
            onClick={onRequestQuit}
            className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[9.5px] text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Power size={11} strokeWidth={1.9} />
            退出应用
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

