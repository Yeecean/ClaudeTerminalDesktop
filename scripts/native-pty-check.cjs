const { app } = require('electron')
const path = require('node:path')

const marker = 'CTD_PTY_OK'

app.whenReady().then(() => {
  let pty
  try {
    pty = require('node-pty')
  } catch (error) {
    console.error('node-pty load failed:', error)
    app.exit(1)
    return
  }

  const shell =
    process.env.SystemRoot &&
    path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

  let output = ''
  let finished = false
  const failTimer = setTimeout(() => {
    if (finished) return
    finished = true
    console.error('ConPTY check timed out')
    app.exit(1)
  }, 8000)

  try {
    const terminal = pty.spawn(
      shell,
      ['-NoLogo', '-NoProfile', '-Command', `Write-Output ${marker}`],
      {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
        useConpty: true
      }
    )

    terminal.onData((data) => {
      output += data
    })
    terminal.onExit(({ exitCode }) => {
      if (finished) return
      finished = true
      clearTimeout(failTimer)
      if (!output.includes(marker) || exitCode !== 0) {
        console.error(`ConPTY check failed (exit ${exitCode})`)
        app.exit(1)
        return
      }
      console.log(`ConPTY check passed (${terminal.pid})`)
      app.exit(0)
    })
  } catch (error) {
    clearTimeout(failTimer)
    console.error('ConPTY spawn failed:', error)
    app.exit(1)
  }
})

