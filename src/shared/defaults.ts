import type { AppSettings } from './types'

export const DEFAULT_ANSI_PALETTE = [
  '#2d2924',
  '#e06c75',
  '#98c379',
  '#e5c07b',
  '#61afef',
  '#c678dd',
  '#56b6c2',
  '#d7d0c5',
  '#5c5650',
  '#ff7b86',
  '#aee08a',
  '#f1d18a',
  '#7cc4ff',
  '#d99bea',
  '#6bd5df',
  '#fff8ed'
] as const

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  themeMode: 'system',
  layoutMode: 'navigation',
  gui: {
    fontFamily: 'Segoe UI Variable',
    fontSize: 14,
    fontWeight: 400,
    density: 'comfortable'
  },
  terminal: {
    fontFamily: 'Cascadia Code, Consolas, monospace',
    fontSize: 14,
    fontWeight: 400,
    fontWeightBold: 600,
    lineHeight: 1.25,
    padding: 14,
    cursorStyle: 'bar',
    cursorBlink: true,
    scrollback: 10000,
    scrollSensitivity: 1.1,
    background: '#1f1d1a',
    foreground: '#f3ece0',
    cursorColor: '#e58e70',
    selectionBackground: '#8f5d48',
    ansi: [...DEFAULT_ANSI_PALETTE]
  },
  shell: {
    kind: 'windows-powershell',
    customPath: '',
    loadProfile: true
  },
  window: {
    hideOnClose: true
  }
}

export const SETTINGS_LIMITS = {
  guiFontMin: 13,
  guiFontMax: 20,
  terminalFontMin: 9,
  terminalFontMax: 32,
  lineHeightMin: 0.8,
  lineHeightMax: 2.2,
  paddingMin: 0,
  paddingMax: 48,
  scrollbackMin: 1000,
  scrollbackMax: 100000,
  scrollSensitivityMin: 0.25,
  scrollSensitivityMax: 5
} as const

