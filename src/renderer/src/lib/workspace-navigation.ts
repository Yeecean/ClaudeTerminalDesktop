import type { Project, SessionRecord } from '../../../shared/types'

export type NavigationDirection = -1 | 1

export function isActiveSession(session: SessionRecord): boolean {
  return session.status === 'running' || session.status === 'starting'
}

export function visibleProjectSessions(
  projectId: string,
  sessions: SessionRecord[],
  runtimeStartedAt: string
): SessionRecord[] {
  const projectSessions = sessions.filter((session) => session.projectId === projectId)
  const active = projectSessions
    .filter(isActiveSession)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const ended = projectSessions
    .filter(
      (session) =>
        (session.status === 'exited' || session.status === 'failed') &&
        Boolean(session.endedAt && session.endedAt >= runtimeStartedAt)
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-2)
  return [...active, ...ended]
}

export function preferredProjectSession(
  projectId: string,
  sessions: SessionRecord[],
  runtimeStartedAt: string,
  rememberedSessionId?: string
): SessionRecord | null {
  const visible = visibleProjectSessions(projectId, sessions, runtimeStartedAt)
  return (
    visible.find((session) => session.id === rememberedSessionId) ??
    visible.find(isActiveSession) ??
    visible[0] ??
    null
  )
}

export function adjacentId<T extends { id: string }>(
  items: T[],
  currentId: string | null,
  direction: NavigationDirection
): string | null {
  if (!items.length) return null
  const currentIndex = items.findIndex((item) => item.id === currentId)
  if (currentIndex === -1) {
    return (direction > 0 ? items[0] : items[items.length - 1])?.id ?? null
  }
  const nextIndex = (currentIndex + direction + items.length) % items.length
  return items[nextIndex]?.id ?? null
}

export function adjacentProjectId(
  projects: Project[],
  currentId: string | null,
  direction: NavigationDirection
): string | null {
  return adjacentId(projects, currentId, direction)
}
