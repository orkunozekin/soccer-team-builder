import { describe, expect, it } from 'vitest'
import { computeAuditStats } from './computeAuditStats'
import type { AuditLog } from '@/types/auditLog'

function makeLog(overrides: Partial<AuditLog> & Pick<AuditLog, 'action'>): AuditLog {
  return {
    id: 'log_1',
    actorUid: 'user1',
    source: 'api',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeAuditStats', () => {
  it('aggregates events by category, source, and day', () => {
    const today = new Date()
    const logs: AuditLog[] = [
      makeLog({
        id: '1',
        action: 'rsvp.confirmed',
        source: 'api',
        createdAt: today.toISOString(),
      }),
      makeLog({
        id: '2',
        action: 'auth.login',
        source: 'client',
        createdAt: today.toISOString(),
      }),
      makeLog({
        id: '3',
        action: 'rsvp.failed',
        source: 'api',
        metadata: { outcome: 'failed' },
        createdAt: today.toISOString(),
      }),
    ]

    const stats = computeAuditStats(logs, {
      totalEvents: 100,
      eventsToday: 3,
      eventsThisWeek: 10,
      chartDays: 7,
    })

    expect(stats.totalEvents).toBe(100)
    expect(stats.eventsToday).toBe(3)
    expect(stats.rsvpCount).toBe(1)
    expect(stats.failureCount).toBe(1)
    expect(stats.eventsByCategory).toEqual(
      expect.arrayContaining([
        { category: 'RSVPs', count: 2 },
        { category: 'Auth', count: 1 },
      ])
    )
    expect(stats.eventsBySource).toEqual(
      expect.arrayContaining([
        { source: 'api', count: 2 },
        { source: 'client', count: 1 },
      ])
    )
    expect(stats.eventsByDay).toHaveLength(7)
    const todayKey = stats.eventsByDay[stats.eventsByDay.length - 1]
    expect(todayKey?.count).toBe(3)
  })
})
