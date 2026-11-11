type KeydownHandler = (event: KeyboardEvent) => boolean

let handler: KeydownHandler | null = null
let installed = false

export function installShortcutRouter(): void {
  if (installed) return
  installed = true
  window.addEventListener(
    'keydown',
    (event) => {
      if (!handler?.(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    true
  )
}

export function setShortcutHandler(next: KeydownHandler | null): void {
  handler = next
}
