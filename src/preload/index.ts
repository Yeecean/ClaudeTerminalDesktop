import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('ctd', {
  platform: process.platform
})

