import type { CtdApi } from '../shared/api'

declare global {
  interface Window {
    ctd: CtdApi
  }
}

export {}

