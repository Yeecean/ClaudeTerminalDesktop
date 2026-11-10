import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  developmentOrigin,
  isTrustedRendererUrl
} from '../../src/main/renderer-trust'

const rendererFile = resolve('out/renderer/index.html')
const rendererUrl = pathToFileURL(rendererFile).href

describe('renderer trust', () => {
  it('accepts only loopback development URLs', () => {
    expect(developmentOrigin('http://localhost:5173/')).toBe(
      'http://localhost:5173'
    )
    expect(developmentOrigin('http://127.0.0.1:5173/')).toBe(
      'http://127.0.0.1:5173'
    )
    expect(developmentOrigin('https://example.com/')).toBeNull()
    expect(developmentOrigin('file:///C:/app/index.html')).toBeNull()
  })

  it('accepts the exact packaged renderer file URL', () => {
    expect(isTrustedRendererUrl(rendererUrl, rendererFile, null)).toBe(true)
  })

  it('rejects a different local or remote page', () => {
    expect(
      isTrustedRendererUrl(
        pathToFileURL(resolve('out/renderer/other.html')).href,
        rendererFile,
        null
      )
    ).toBe(false)
    expect(
      isTrustedRendererUrl('https://example.com/', rendererFile, null)
    ).toBe(false)
  })

  it('accepts a sender from the trusted development origin', () => {
    expect(
      isTrustedRendererUrl(
        'http://localhost:5173/settings',
        rendererFile,
        'http://localhost:5173'
      )
    ).toBe(true)
    expect(
      isTrustedRendererUrl(
        'https://example.com/',
        rendererFile,
        'http://localhost:5173'
      )
    ).toBe(false)
  })

  it('does not accept lookalike loopback hosts', () => {
    expect(
      developmentOrigin('https://localhost.example.com/')
    ).toBeNull()
    expect(
      developmentOrigin('http://localhost.example.com/')
    ).toBeNull()
  })
})
