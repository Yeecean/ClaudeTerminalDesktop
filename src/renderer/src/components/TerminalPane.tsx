import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import {
  Terminal,
  type ITheme
} from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { cn } from '../lib/utils'

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
    lineHeight: terminal.lineHeight,
    scrollback: terminal.scrollback,
    scrollSensitivity: terminal.scrollSensitivity,
    theme: terminalTheme(settings),
    smoothScrollDuration: 0,
    windowsPty: { backend: 'conpty' }
  }
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
  const webglRef = useRef<WebglAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchOpenRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  visibleRef.current = visible
  latestSettingsRef.current = settings

  const fitAndResize = (): void => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const host = hostRef.current
    if (!terminal || !fitAddon || !host || !visibleRef.current) return
    if (host.clientWidth < 40 || host.clientHeight < 30) return
    try {
      fitAddon.fit()
    } catch {}
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const terminal = new Terminal(terminalOptions(latestSettingsRef.current))
    terminalRef.current = terminal

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const unicode11 = new Unicode11Addon()
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(unicode11)
    terminal.unicode.activeVersion = '11'
    terminal.open(host)

    const unsubscribe = registerWriter(sessionId, (data) => {
      terminal.write(data)
    })

    const dataDisposable = terminal.onData((data) => {
      void window.ctd.writeSession(sessionId, data).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '无法写入终端。'
        if (!message.includes('已结束')) onError(message)
      })
    })

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (!visibleRef.current) return
      void window.ctd.resizeSession(sessionId, cols, rows).catch(() => {})
    })

    const copySelection = (): void => {
      const selection = terminal.getSelection()
      if (!selection) return
      void window.ctd.writeClipboardText(selection).catch(() => {
        onError('无法写入系统剪贴板。')
      })
      terminal.clearSelection()
    }

    const pasteClipboard = (): void => {
      void window.ctd
        .readClipboardText()
        .then((text) => {
          if (text) terminal.paste(text)
        })
        .catch(() => onError('无法读取系统剪贴板。'))
    }

    const openSearch = (): void => {
      searchOpenRef.current = true
      setSearchOpen(true)
    }

    const closeSearch = (): void => {
      searchOpenRef.current = false
      setSearchOpen(false)
      terminal.focus()
    }

    terminal.attachCustomKeyEventHandler((event) => {
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
        terminal.hasSelection()
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

    const resizeObserver = new ResizeObserver(() => fitAndResize())
    resizeObserver.observe(host)
    window.requestAnimationFrame(() => {
      fitAndResize()
      if (visibleRef.current) terminal.focus()
    })

    return () => {
      resizeObserver.disconnect()
      dataDisposable.dispose()
      resizeDisposable.dispose()
      unsubscribe()
      webglRef.current?.dispose()
      webglRef.current = null
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
    }
  }, [sessionId])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const next = settings.terminal
    terminal.options.fontFamily = next.fontFamily
    terminal.options.fontSize = next.fontSize
    terminal.options.fontWeight = next.fontWeight
    terminal.options.fontWeightBold = next.fontWeightBold
    terminal.options.lineHeight = next.lineHeight
    terminal.options.cursorBlink = next.cursorBlink
    terminal.options.cursorStyle = next.cursorStyle
    terminal.options.scrollback = next.scrollback
    terminal.options.scrollSensitivity = next.scrollSensitivity
    terminal.options.theme = terminalTheme(settings)
    window.requestAnimationFrame(fitAndResize)
  }, [settings])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!visible) return
    window.requestAnimationFrame(() => {
      fitAndResize()
      terminalRef.current?.focus()
    })
  }, [visible])

  useEffect(() => {
    if (!visible || webglRef.current || !terminalRef.current) return
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => {
        webgl.dispose()
        webglRef.current = null
      })
      terminalRef.current.loadAddon(webgl)
      webglRef.current = webgl
    } catch {}
  }, [visible])

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
        ref={hostRef}
        className="terminal-host min-h-0 flex-1"
        style={{ padding: settings.terminal.padding }}
      />

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

