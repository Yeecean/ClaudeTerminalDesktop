import { pathToFileURL } from 'node:url'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function developmentOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!LOOPBACK_HOSTNAMES.has(url.hostname)) return null
    return url.origin
  } catch {
    return null
  }
}

export function isTrustedRendererUrl(
  candidate: string,
  rendererFilePath: string,
  trustedDevelopmentOrigin: string | null
): boolean {
  try {
    const url = new URL(candidate)
    if (trustedDevelopmentOrigin && url.origin === trustedDevelopmentOrigin) {
      return true
    }
    return url.href === pathToFileURL(rendererFilePath).href
  } catch {
    return false
  }
}
