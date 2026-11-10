import { DEFAULT_ANSI_PALETTE, DEFAULT_SETTINGS, SETTINGS_LIMITS } from './defaults'
import type {
  AppSettings,
  CursorStyle,
  DensityMode,
  LayoutMode,
  ThemeMode
} from './types'

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
const LAYOUT_MODES: LayoutMode[] = ['focus', 'navigation', 'parallel']
const DENSITIES: DensityMode[] = ['compact', 'comfortable']
const CURSOR_STYLES: CursorStyle[] = ['bar', 'block', 'underline']
const SHELL_KINDS: AppSettings['shell']['kind'][] = [
  'windows-powershell',
  'powershell-7',
  'custom'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback: string, maxLength = 160): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(numberInRange(value, fallback, min, max))
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function oneOf<T extends string>(value: unknown, values: T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)
    ? value
    : fallback
}

export function normalizeSettings(input: unknown): AppSettings {
  const root = isRecord(input) ? input : {}
  const gui = isRecord(root.gui) ? root.gui : {}
  const terminal = isRecord(root.terminal) ? root.terminal : {}
  const shell = isRecord(root.shell) ? root.shell : {}
  const windowSettings = isRecord(root.window) ? root.window : {}
  const defaults = DEFAULT_SETTINGS

  const ansiInput = Array.isArray(terminal.ansi) ? terminal.ansi : []
  const ansi = DEFAULT_ANSI_PALETTE.map((fallback, index) =>
    color(ansiInput[index], fallback)
  )

  return {
    version: 1,
    themeMode: oneOf(root.themeMode, THEME_MODES, defaults.themeMode),
    layoutMode: oneOf(root.layoutMode, LAYOUT_MODES, defaults.layoutMode),
    gui: {
      fontFamily: text(gui.fontFamily, defaults.gui.fontFamily, 120),
      fontSize: integerInRange(
        gui.fontSize,
        defaults.gui.fontSize,
        SETTINGS_LIMITS.guiFontMin,
        SETTINGS_LIMITS.guiFontMax
      ),
      fontWeight: integerInRange(gui.fontWeight, defaults.gui.fontWeight, 300, 700),
      density: oneOf(gui.density, DENSITIES, defaults.gui.density)
    },
    terminal: {
      fontFamily: text(terminal.fontFamily, defaults.terminal.fontFamily, 200),
      fontSize: integerInRange(
        terminal.fontSize,
        defaults.terminal.fontSize,
        SETTINGS_LIMITS.terminalFontMin,
        SETTINGS_LIMITS.terminalFontMax
      ),
      fontWeight: integerInRange(terminal.fontWeight, defaults.terminal.fontWeight, 300, 800),
      fontWeightBold: integerInRange(
        terminal.fontWeightBold,
        defaults.terminal.fontWeightBold,
        300,
        900
      ),
      lineHeight: numberInRange(
        terminal.lineHeight,
        defaults.terminal.lineHeight,
        SETTINGS_LIMITS.lineHeightMin,
        SETTINGS_LIMITS.lineHeightMax
      ),
      padding: integerInRange(
        terminal.padding,
        defaults.terminal.padding,
        SETTINGS_LIMITS.paddingMin,
        SETTINGS_LIMITS.paddingMax
      ),
      cursorStyle: oneOf(terminal.cursorStyle, CURSOR_STYLES, defaults.terminal.cursorStyle),
      cursorBlink: booleanValue(terminal.cursorBlink, defaults.terminal.cursorBlink),
      scrollback: integerInRange(
        terminal.scrollback,
        defaults.terminal.scrollback,
        SETTINGS_LIMITS.scrollbackMin,
        SETTINGS_LIMITS.scrollbackMax
      ),
      scrollSensitivity: numberInRange(
        terminal.scrollSensitivity,
        defaults.terminal.scrollSensitivity,
        SETTINGS_LIMITS.scrollSensitivityMin,
        SETTINGS_LIMITS.scrollSensitivityMax
      ),
      background: color(terminal.background, defaults.terminal.background),
      foreground: color(terminal.foreground, defaults.terminal.foreground),
      cursorColor: color(terminal.cursorColor, defaults.terminal.cursorColor),
      selectionBackground: color(
        terminal.selectionBackground,
        defaults.terminal.selectionBackground
      ),
      ansi
    },
    shell: {
      kind: oneOf(shell.kind, SHELL_KINDS, defaults.shell.kind),
      customPath: text(shell.customPath, defaults.shell.customPath, 500),
      loadProfile: booleanValue(shell.loadProfile, defaults.shell.loadProfile)
    },
    window: {
      hideOnClose: booleanValue(
        windowSettings.hideOnClose,
        defaults.window.hideOnClose
      )
    }
  }
}

export function mergeSettings(current: AppSettings, patch: unknown): AppSettings {
  const root = isRecord(patch) ? patch : {}
  const base = normalizeSettings(current)

  return normalizeSettings({
    ...base,
    ...root,
    gui: isRecord(root.gui) ? { ...base.gui, ...root.gui } : base.gui,
    terminal: isRecord(root.terminal)
      ? { ...base.terminal, ...root.terminal }
      : base.terminal,
    shell: isRecord(root.shell) ? { ...base.shell, ...root.shell } : base.shell,
    window: isRecord(root.window)
      ? { ...base.window, ...root.window }
      : base.window
  })
}

