import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import {
  Terminal,
  type ITheme
} from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { cn } from '../lib/utils'

const MIN_HOST_WIDTH = 40
const MIN_HOST_HEIGHT = 30
const MAX_INITIALIZATION_FRAMES = 120

interface TerminalPaneProps {
  sessionId: string
  settings: AppSettings
  visible: boolean
  registerWriter: (sessionId: string, writer: (data: string) => void) => () => void
  onError: (message: string) => void
}

function terminalTheme(settings: AppSettings): ITheme {
  const ansi = settings.terminal.ansi
  return {
    background: settings.terminal.background,
    foreground: settings.terminal.foreground,
    cursor: settings.terminal.cursorColor,
    cursorAccent: settings.terminal.background,
    selectionBackground: settings.terminal.selectionBackground,
    black: ansi[0],
    red: ansi[1],
    green: ansi[2],
    yellow: ansi[3],
    blue: ansi[4],
    magenta: ansi[5],
    cyan: ansi[6],
    white: ansi[7],
    brightBlack: ansi[8],
    brightRed: ansi[9],
    brightGreen: ansi[10],
    brightYellow: ansi[11],
    brightBlue: ansi[12],
    brightMagenta: ansi[13],
    brightCyan: ansi[14],
    brightWhite: ansi[15]
  }
}

function terminalOptions(settings: AppSettings): ConstructorParameters<typeof Terminal>[0] {
  const terminal = settings.terminal
  return {
    allowProposedApi: true,
    cursorBlink: terminal.cursorBlink,
    cursorStyle: terminal.cursorStyle,
    fontFamily: terminal.fontFamily,
    fontSize: terminal.fontSize,
    fontWeight: terminal.fontWeight,
    fontWeightBold: terminal.fontWeightBold,
    letterSpacing: 0,
    lineHeight: terminal.lineHeight,
    scrollback: terminal.scrollback,
    scrollSensitivity: terminal.scrollSensitivity,
    theme: terminalTheme(settings),
    smoothScrollDuration: 0,
    windowsPty: { backend: 'conpty' }
  }
}

function focusIsInSidebar(): boolean {
  const activeElement = document.activeElement
  return activeElement instanceof Element && Boolean(activeElement.closest('aside'))
}

function hostHasUsableSize(host: HTMLDivElement | null): host is HTMLDivElement {
  return Boolean(
    host &&
      host.clientWidth >= MIN_HOST_WIDTH &&
      host.clientHeight >= MIN_HOST_HEIGHT
  )
}

function recordTerminalSize(
  host: HTMLDivElement | null,
  cols: number,
  rows: number
): void {
  const terminalElement = host?.querySelector('.xterm')
  if (terminalElement instanceof HTMLElement) {
    terminalElement.dataset.ctdCols = String(cols)
    terminalElement.dataset.ctdRows = String(rows)
  }
}

function applyTerminalTypography(
  terminal: Terminal,
  settings: AppSettings
): void {
  const textarea = terminal.textarea
  if (!textarea) return
  const terminalSettings = settings.terminal
  textarea.style.fontFamily = terminalSettings.fontFamily
  textarea.style.fontSize = `${terminalSettings.fontSize}px`
  textarea.style.fontWeight = String(terminalSettings.fontWeight)
  textarea.style.lineHeight = String(terminalSettings.lineHeight)
  textarea.style.letterSpacing = '0px'
}

export function TerminalPane({
  sessionId,
  settings,
  visible,
  registerWriter,
  onError
}: TerminalPaneProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const visibleRef = useRef(visible)
  const latestSettingsRef = useRef(settings)
  const registerWriterRef = useRef(registerWriter)
  const onErrorRef = useRef(onError)
  const writerCleanupRef = useRef<(() => void) | null>(null)
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const initializationFrameRef = useRef<number | null>(null)
  const showFrameRef = useRef<number | null>(null)
  const initializingRef = useRef(false)
  const lastSentSizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchOpenRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  visibleRef.current = visible
  latestSettingsRef.current = settings
  registerWriterRef.current = registerWriter
  onErrorRef.current = onError

  const sendResize = useCallback(
    (cols: number, rows: number): void => {
      if (!visibleRef.current || !Number.isFinite(cols) || !Number.isFinite(rows)) {
        return
      }
      const nextCols = Math.round(cols)
      const nextRows = Math.round(rows)
      if (nextCols < 1 || nextRows < 1) return
      const previous = lastSentSizeRef.current
      if (previous?.cols === nextCols && previous.rows === nextRows) return
      lastSentSizeRef.current = { cols: nextCols, rows: nextRows }
      void window.ctd
        .resizeSession(sessionId, nextCols, nextRows)
        .catch(() => {
          lastSentSizeRef.current = null
        })
    },
    [sessionId]
  )

  const fitAndRefresh = useCallback(
    (refresh: boolean): boolean => {
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      const host = hostRef.current
      if (!terminal || !fitAddon || !host || !visibleRef.current) return false
      if (!hostHasUsableSize(host)) return false

      try {
        fitAddon.fit()
      } catch {
        return false
      }

      if (
        !Number.isFinite(terminal.cols) ||
        !Number.isFinite(terminal.rows) ||
        terminal.cols < 1 ||
        terminal.rows < 1
      ) {
        return false
      }

      recordTerminalSize(host, terminal.cols, terminal.rows)
      sendResize(terminal.cols, terminal.rows)
      if (refresh) terminal.refresh(0, terminal.rows - 1)
      return true
    },
    [sendResize]
  )

  const scheduleShow = useCallback((): void => {
    if (showFrameRef.current !== null) {
      cancelAnimationFrame(showFrameRef.current)
    }
    showFrameRef.current = requestAnimationFrame(() => {
      showFrameRef.current = null
      if (!visibleRef.current) return
      if (!fitAndRefresh(true)) return
      if (!focusIsInSidebar()) terminalRef.current?.focus()
    })
  }, [fitAndRefresh])

  const initializeTerminal = useCallback((): boolean => {
    const host = hostRef.current
    if (
      !host ||
      terminalRef.current ||
      initializingRef.current ||
      !visibleRef.current ||
      !hostHasUsableSize(host)
    ) {
      return false
    }

    initializingRef.current = true
    let terminal: Terminal | null = null
    try {
      const created = new Terminal(terminalOptions(latestSettingsRef.current))
      terminal = created
      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      const unicode11 = new Unicode11Addon()
      created.loadAddon(fitAddon)
      created.loadAddon(searchAddon)
      created.loadAddon(unicode11)
      created.unicode.activeVersion = '11'

      // xterm.open() must only run after the host is visible and measurable.
      created.open(host)
      applyTerminalTypography(created, latestSettingsRef.current)
      terminalRef.current = created
      fitAddonRef.current = fitAddon
      searchAddonRef.current = searchAddon

      const dataDisposable = created.onData((data) => {
        void window.ctd.writeSession(sessionId, data).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : '无法写入终端。'
          if (!message.includes('已结束')) onErrorRef.current(message)
        })
      })

      const resizeDisposable = created.onResize(({ cols, rows }) => {
        recordTerminalSize(hostRef.current, cols, rows)
        sendResize(cols, rows)
      })
      disposablesRef.current = [dataDisposable, resizeDisposable]
      // Attach the PTY writer only after the terminal input path is ready:
      // registerWriter synchronously consumes any buffered PTY output, and
      // xterm may answer a cursor-position query from that data immediately.
      writerCleanupRef.current = registerWriterRef.current(sessionId, (data) => {
        created.write(data)
      })

      const copySelection = (): void => {
        const selection = created.getSelection()
        if (!selection) return
        void window.ctd.writeClipboardText(selection).catch(() => {
          onErrorRef.current('无法写入系统剪贴板。')
        })
        created.clearSelection()
      }

      const pasteClipboard = (): void => {
        void window.ctd
          .readClipboardText()
          .then((text) => {
            if (text) created.paste(text)
          })
          .catch(() => onErrorRef.current('无法读取系统剪贴板。'))
      }

      const openSearch = (): void => {
        searchOpenRef.current = true
        setSearchOpen(true)
      }

      const closeSearch = (): void => {
        searchOpenRef.current = false
        setSearchOpen(false)
        created.focus()
      }

      created.attachCustomKeyEventHandler((event) => {
        if (event.type !== 'keydown') return true

        if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') {
          copySelection()
          return false
        }
        if (
          event.ctrlKey &&
          !event.altKey &&
          !event.shiftKey &&
          event.code === 'KeyC' &&
          created.hasSelection()
        ) {
          copySelection()
          return false
        }
        if (event.ctrlKey && !event.altKey && event.code === 'KeyV') {
          pasteClipboard()
          return false
        }
        if (event.ctrlKey && !event.altKey && event.code === 'KeyF') {
          openSearch()
          return false
        }
        if (event.key === 'Escape' && searchOpenRef.current) {
          closeSearch()
          return false
        }
        return true
      })

      return true
    } catch (error) {
      if (writerCleanupRef.current) {
        writerCleanupRef.current()
        writerCleanupRef.current = null
      }
      for (const disposable of disposablesRef.current) disposable.dispose()
      disposablesRef.current = []
      fitAddonRef.current = null
      searchAddonRef.current = null
      terminalRef.current = null
      try {
        terminal?.dispose()
      } catch {}
      const message =
        error instanceof Error ? error.message : '无法初始化终端渲染器。'
      onErrorRef.current(message)
      return false
    } finally {
      initializingRef.current = false
    }
  }, [sendResize, sessionId])

  const disposeTerminal = useCallback((): void => {
    if (initializationFrameRef.current !== null) {
      cancelAnimationFrame(initializationFrameRef.current)
      initializationFrameRef.current = null
    }
    if (showFrameRef.current !== null) {
      cancelAnimationFrame(showFrameRef.current)
      showFrameRef.current = null
    }
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    writerCleanupRef.current?.()
    writerCleanupRef.current = null
    for (const disposable of disposablesRef.current) disposable.dispose()
    disposablesRef.current = []
    fitAddonRef.current = null
    searchAddonRef.current = null
    terminalRef.current?.dispose()
    terminalRef.current = null
    lastSentSizeRef.current = null
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(() => {
      if (!visibleRef.current) return
      if (!terminalRef.current) {
        if (initializeTerminal()) scheduleShow()
        return
      }
      fitAndRefresh(false)
    })
    observer.observe(host)
    resizeObserverRef.current = observer
    return () => {
      observer.disconnect()
      if (resizeObserverRef.current === observer) resizeObserverRef.current = null
      disposeTerminal()
    }
  }, [disposeTerminal, fitAndRefresh, initializeTerminal, scheduleShow])

  useEffect(() => {
    if (!visible) {
      lastSentSizeRef.current = null
      if (initializationFrameRef.current !== null) {
        cancelAnimationFrame(initializationFrameRef.current)
        initializationFrameRef.current = null
      }
      if (showFrameRef.current !== null) {
        cancelAnimationFrame(showFrameRef.current)
        showFrameRef.current = null
      }
      return
    }

    let cancelled = false
    let attempts = 0
    const attempt = (): void => {
      initializationFrameRef.current = null
      if (cancelled || !visibleRef.current) return
      if (!terminalRef.current) {
        if (initializeTerminal()) {
          scheduleShow()
          return
        }
        attempts += 1
        if (attempts < MAX_INITIALIZATION_FRAMES) {
          initializationFrameRef.current = requestAnimationFrame(attempt)
        }
        return
      }
      scheduleShow()
    }
    initializationFrameRef.current = requestAnimationFrame(attempt)

    return () => {
      cancelled = true
      if (initializationFrameRef.current !== null) {
        cancelAnimationFrame(initializationFrameRef.current)
        initializationFrameRef.current = null
      }
    }
  }, [initializeTerminal, scheduleShow, visible])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const next = settings.terminal
    terminal.options.fontFamily = next.fontFamily
    terminal.options.fontSize = next.fontSize
    terminal.options.fontWeight = next.fontWeight
    terminal.options.fontWeightBold = next.fontWeightBold
    terminal.options.letterSpacing = 0
    terminal.options.lineHeight = next.lineHeight
    terminal.options.cursorBlink = next.cursorBlink
    terminal.options.cursorStyle = next.cursorStyle
    terminal.options.scrollback = next.scrollback
    terminal.options.scrollSensitivity = next.scrollSensitivity
    terminal.options.theme = terminalTheme(settings)
    applyTerminalTypography(terminal, settings)
    if (visibleRef.current) {
      window.requestAnimationFrame(() => {
        fitAndRefresh(true)
      })
    }
  }, [fitAndRefresh, settings])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const runSearch = (direction: 'next' | 'previous'): void => {
    if (!searchQuery) return
    if (direction === 'next') {
      searchAddonRef.current?.findNext(searchQuery, {
        incremental: true,
        caseSensitive: false
      })
    } else {
      searchAddonRef.current?.findPrevious(searchQuery, {
        incremental: true,
        caseSensitive: false
      })
    }
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--terminal-surface)]">
      <div
        className="terminal-frame min-h-0 flex-1"
        style={{ padding: settings.terminal.padding }}
      >
        <div ref={hostRef} className="terminal-host bg-[var(--terminal-surface)]" />
      </div>

      {searchOpen ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#25211d]/95 p-1 shadow-xl backdrop-blur">
          <Search size={12} className="ml-1.5 text-white/40" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            spellCheck={false}
            placeholder="在终端中查找"
            className="h-7 w-40 bg-transparent px-1 text-[10.5px] text-white/85 outline-none placeholder:text-white/30"
            onChange={(event) => {
              setSearchQuery(event.target.value)
              if (event.target.value) {
                searchAddonRef.current?.findNext(event.target.value, {
                  incremental: true,
                  caseSensitive: false
                })
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runSearch(event.shiftKey ? 'previous' : 'next')
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                searchOpenRef.current = false
                setSearchOpen(false)
                terminalRef.current?.focus()
              }
            }}
          />
          <button
            type="button"
            title="上一个"
            className="flex size-7 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white/85"
            onClick={() => runSearch('previous')}
          >
            <span className="rotate-180 text-[11px]">⌄</span>
          </button>
          <button
            type="button"
            title="下一个"
            className="flex size-7 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white/85"
            onClick={() => runSearch('next')}
          >
            <span className="text-[11px]">⌄</span>
          </button>
          <button
            type="button"
            title="关闭搜索"
            aria-label="关闭搜索"
            className="flex size-7 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white/85"
            onClick={() => {
              searchOpenRef.current = false
              setSearchOpen(false)
              terminalRef.current?.focus()
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  )
}

