export const IPC = {
  bootstrap: 'ctd:bootstrap',
  settingsUpdate: 'ctd:settings:update',
  settingsChanged: 'ctd:settings:changed',
  projectsAdd: 'ctd:projects:add',
  projectsRemove: 'ctd:projects:remove',
  sessionsCreate: 'ctd:sessions:create',
  sessionsWrite: 'ctd:sessions:write',
  sessionsResize: 'ctd:sessions:resize',
  sessionsEnd: 'ctd:sessions:end',
  ptyData: 'ctd:pty:data',
  ptyExit: 'ctd:pty:exit',
  stateChanged: 'ctd:state:changed',
  clipboardRead: 'ctd:clipboard:read',
  clipboardWrite: 'ctd:clipboard:write',
  windowTheme: 'ctd:window:theme',
  appRequestQuit: 'ctd:app:request-quit'
} as const

