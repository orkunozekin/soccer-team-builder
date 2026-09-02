import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { verifyAdmin } from '@/lib/api/auth'
import { countAuditLogs, queryAuditLogs } from '@/lib/audit/queryAuditLogs'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
}))

vi.mock('@/lib/audit/queryAuditLogs', () => ({
  queryAuditLogs: vi.fn(),
  countAuditLogs: vi.fn(),
}))

describe('GET /api/audit/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminDb).mockReturnValue({} as never)
  })

  it('requires admin', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'user1',
      isAdmin: false,
      error: null,
    })

    const response = await GET(new NextRequest('http://localhost/api/audit/stats'))

    expect(response.status).toBe(403)
  })

  it('returns aggregated stats for admins', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin1',
      isAdmin: true,
      error: null,
    })
    vi.mocked(countAuditLogs)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(12)
    vi.mocked(queryAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'audit_1',
          action: 'rsvp.confirmed',
          actorUid: 'user1',
          source: 'api',
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    })

    const response = await GET(new NextRequest('http://localhost/api/audit/stats'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.stats.totalEvents).toBe(50)
    expect(body.stats.eventsToday).toBe(5)
    expect(body.stats.eventsThisWeek).toBe(12)
    expect(body.stats.eventsByDay).toHaveLength(14)
  })
})
