import { describe, expect, it } from 'vitest'
import { sanitizedEnvironment } from '../../src/main/pty-manager'

describe('PTY environment', () => {
  it('forces terminal color capabilities even when inherited from CI', () => {
    const environment = sanitizedEnvironment({
      TERM: 'dumb',
      COLORTERM: '',
      NO_COLOR: '1',
      CLICOLOR: '0',
      CLICOLOR_FORCE: '0'
    })

    expect(environment.TERM).toBe('xterm-256color')
    expect(environment.COLORTERM).toBe('truecolor')
    expect(environment.NO_COLOR).toBeUndefined()
    expect(environment.CLICOLOR).toBeUndefined()
    expect(environment.CLICOLOR_FORCE).toBeUndefined()
  })
})
