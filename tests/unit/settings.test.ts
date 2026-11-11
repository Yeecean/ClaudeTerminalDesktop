import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/defaults'
import { mergeSettings, normalizeSettings } from '../../src/shared/settings'

describe('settings normalization', () => {
  it('returns complete defaults for missing or invalid input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('invalid')).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numeric values and rejects invalid enums and colors', () => {
    const settings = normalizeSettings({
      themeMode: 'blue',
      layoutMode: 'workspace',
      gui: {
        fontSize: 999,
        fontWeight: 100,
        density: 'dense'
      },
      terminal: {
        fontSize: 1,
        lineHeight: 20,
        padding: -10,
        scrollback: 1,
        scrollSensitivity: 50,
        cursorStyle: 'beam',
        background: 'red',
        ansi: ['not-a-color']
      },
      shell: {
        kind: 'cmd',
        customPath: '   ',
        loadProfile: 'yes'
      }
    })

    expect(settings.themeMode).toBe('system')
    expect(settings.layoutMode).toBe('navigation')
    expect(settings.gui.fontSize).toBe(20)
    expect(settings.gui.fontWeight).toBe(300)
    expect(settings.gui.density).toBe('comfortable')
    expect(settings.terminal.fontSize).toBe(9)
    expect(settings.terminal.lineHeight).toBe(2.2)
    expect(settings.terminal.padding).toBe(0)
    expect(settings.terminal.scrollback).toBe(1000)
    expect(settings.terminal.scrollSensitivity).toBe(5)
    expect(settings.terminal.cursorStyle).toBe('bar')
    expect(settings.terminal.background).toBe(DEFAULT_SETTINGS.terminal.background)
    expect(settings.terminal.ansi).toEqual(DEFAULT_SETTINGS.terminal.ansi)
    expect(settings.shell.kind).toBe('windows-powershell')
    expect(settings.shell.customPath).toBe('')
    expect(settings.shell.loadProfile).toBe(true)
  })

  it('merges nested patches without dropping unrelated preferences', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      themeMode: 'dark',
      terminal: {
        fontSize: 17,
        cursorBlink: false
      },
      shell: {
        loadProfile: false
      }
    })

    expect(merged.themeMode).toBe('dark')
    expect(merged.terminal.fontSize).toBe(17)
    expect(merged.terminal.cursorBlink).toBe(false)
    expect(merged.shell.loadProfile).toBe(false)
    expect(merged.terminal.fontFamily).toBe(DEFAULT_SETTINGS.terminal.fontFamily)
    expect(merged.gui.fontFamily).toBe(DEFAULT_SETTINGS.gui.fontFamily)
  })

  it('accepts valid hex colors including alpha', () => {
    const settings = normalizeSettings({
      terminal: {
        background: '#112233',
        selectionBackground: '#aabbcc80'
      }
    })

    expect(settings.terminal.background).toBe('#112233')
    expect(settings.terminal.selectionBackground).toBe('#aabbcc80')
  })

  it('migrates the complete legacy terminal font defaults to version 2', () => {
    for (const fontFamily of [
      'Cascadia Code',
      'Cascadia Code, Consolas, monospace'
    ]) {
      const migrated = normalizeSettings({
        version: 1,
        terminal: {
          fontFamily,
          fontSize: 14,
          fontWeight: 400,
          fontWeightBold: 600,
          lineHeight: 1.25,
          padding: 14
        }
      })

      expect(migrated.version).toBe(2)
      expect(migrated.terminal.fontFamily).toBe(
        DEFAULT_SETTINGS.terminal.fontFamily
      )
      expect(migrated.terminal.fontSize).toBe(DEFAULT_SETTINGS.terminal.fontSize)
      expect(migrated.terminal.fontWeight).toBe(
        DEFAULT_SETTINGS.terminal.fontWeight
      )
      expect(migrated.terminal.fontWeightBold).toBe(
        DEFAULT_SETTINGS.terminal.fontWeightBold
      )
      expect(migrated.terminal.lineHeight).toBe(
        DEFAULT_SETTINGS.terminal.lineHeight
      )
    }
  })

  it('preserves customized terminal font settings during migration', () => {
    const customFont = normalizeSettings({
      version: 1,
      terminal: {
        fontFamily: 'JetBrains Mono',
        fontSize: 14,
        fontWeight: 400,
        fontWeightBold: 600,
        lineHeight: 1.25,
        padding: 14
      }
    })
    expect(customFont.terminal.fontFamily).toBe('JetBrains Mono')
    expect(customFont.terminal.fontSize).toBe(14)

    const customSize = normalizeSettings({
      version: 1,
      terminal: {
        fontFamily: 'Cascadia Code, Consolas, monospace',
        fontSize: 15,
        fontWeight: 400,
        fontWeightBold: 600,
        lineHeight: 1.25,
        padding: 14
      }
    })
    expect(customSize.terminal.fontFamily).toBe(
      'Cascadia Code, Consolas, monospace'
    )
    expect(customSize.terminal.fontSize).toBe(15)
    expect(customSize.terminal.lineHeight).toBe(1.25)
  })
})

