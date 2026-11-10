export function App(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-[var(--app-bg)] text-[var(--text-primary)]">
      <header className="titlebar flex h-12 shrink-0 items-center border-b border-[var(--border)] px-4 pr-36">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent)] font-mono text-sm font-bold text-white">
            &gt;_
          </div>
          <div>
            <h1 className="text-[13px] font-semibold tracking-[-0.01em]">
              Claude Terminal Desktop
            </h1>
            <p className="text-[10px] text-[var(--text-muted)]">Desktop shell for Claude Code</p>
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Slice 0
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">应用骨架已启动</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Electron 主进程、Preload 安全边界与 React 渲染层已经连通。下一步接入真实 ConPTY
            终端。
          </p>
        </div>
      </main>
    </div>
  )
}

