import type { AppSettings } from '../../../shared/types'

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveDarkMode(mode: AppSettings['themeMode']): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark())
}

export function applyGuiSettings(settings: AppSettings, dark: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.density = settings.gui.density
  root.style.setProperty(
    '--gui-font-family',
    settings.gui.fontFamily.replace(/["']/g, '').trim() || 'Segoe UI'
  )
  root.style.setProperty('--gui-font-size', `${settings.gui.fontSize}px`)
  root.style.setProperty('--gui-font-weight', String(settings.gui.fontWeight))
  root.style.setProperty('--terminal-font-family', settings.terminal.fontFamily)
  root.style.setProperty('--terminal-font-size', `${settings.terminal.fontSize}px`)
  root.style.setProperty('--terminal-padding', `${settings.terminal.padding}px`)
}

