import { describe, expect, it } from 'vitest'
import type { Project, SessionRecord } from '../../src/shared/types'
import {
  adjacentId,
  adjacentProjectId,
  preferredProjectSession,
  visibleProjectSessions
} from '../../src/renderer/src/lib/workspace-navigation'

const runtimeStartedAt = '2026-11-11T10:00:00.000Z'

function session(
  id: string,
  status: SessionRecord['status'],
  createdAt: string,
  endedAt?: string,
  projectId = 'project-a'
): SessionRecord {
  return {
    id,
    projectId,
    title: id,
    status,
    createdAt,
    lastActivityAt: endedAt ?? createdAt,
    ...(endedAt ? { endedAt } : {})
  }
}

function project(id: string): Project {
  return {
    id,
    name: id,
    path: `C:\\workspace\\${id}`,
    createdAt: '2026-11-11T09:00:00.000Z',
    lastOpenedAt: '2026-11-11T09:00:00.000Z'
  }
}

describe('workspace navigation', () => {
  it('keeps active sessions and recent ended sessions in sidebar order', () => {
    const sessions = [
      session('old-ended', 'exited', '2026-11-10T08:00:00.000Z', '2026-11-10T09:00:00.000Z'),
      session('ended-1', 'exited', '2026-11-11T10:01:00.000Z', '2026-11-11T10:02:00.000Z'),
      session('active-2', 'running', '2026-11-11T10:03:00.000Z'),
      session('active-1', 'starting', '2026-11-11T10:00:00.000Z'),
      session('ended-2', 'failed', '2026-11-11T10:04:00.000Z', '2026-11-11T10:05:00.000Z'),
      session('other-project', 'running', '2026-11-11T10:06:00.000Z', undefined, 'project-b')
    ]

    expect(
      visibleProjectSessions('project-a', sessions, runtimeStartedAt).map(
        (item) => item.id
      )
    ).toEqual(['active-1', 'active-2', 'ended-1', 'ended-2'])
  })

  it('restores a remembered conversation before falling back to an active one', () => {
    const sessions = [
      session('active', 'running', '2026-11-11T10:01:00.000Z'),
      session('ended', 'exited', '2026-11-11T10:02:00.000Z', '2026-11-11T10:03:00.000Z')
    ]

    expect(
      preferredProjectSession(
        'project-a',
        sessions,
        runtimeStartedAt,
        'ended'
      )?.id
    ).toBe('ended')
    expect(
      preferredProjectSession('project-a', sessions, runtimeStartedAt)?.id
    ).toBe('active')
  })

  it('wraps project and session navigation in both directions', () => {
    const projects = [project('a'), project('b'), project('c')]
    const sessions = [
      session('one', 'running', '2026-11-11T10:01:00.000Z'),
      session('two', 'running', '2026-11-11T10:02:00.000Z')
    ]

    expect(adjacentProjectId(projects, 'a', -1)).toBe('c')
    expect(adjacentProjectId(projects, 'c', 1)).toBe('a')
    expect(adjacentProjectId(projects, null, 1)).toBe('a')
    expect(adjacentId(sessions, 'one', -1)).toBe('two')
    expect(adjacentId(sessions, 'two', 1)).toBe('one')
    expect(adjacentId([], null, 1)).toBeNull()
  })
})
