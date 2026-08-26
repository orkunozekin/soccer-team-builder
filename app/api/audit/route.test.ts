import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { verifyAdmin } from '@/lib/api/auth'
import { enrichAuditLogsWithDisplayNames } from '@/lib/audit/enrichAuditLogNames'
import { countAuditLogs, queryAuditLogs } from '@/lib/audit/queryAuditLogs'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({
  verifyAdmin: vi.fn(),
  verifyAuth: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
}))

vi.mock('@/lib/audit/queryAuditLogs', () => ({
  queryAuditLogs: vi.fn(),
  countAuditLogs: vi.fn(),
}))

vi.mock('@/lib/audit/enrichAuditLogNames', () => ({
  enrichAuditLogsWithDisplayNames: vi.fn(async (_db, logs) => logs),
}))

vi.mock('@/lib/services/auditService', () => ({
  recordAuditLog: vi.fn(),
  auditLog: vi.fn(),
}))

describe('GET /api/audit', () => {
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

    const response = await GET(
      new NextRequest('http://localhost/api/audit')
    )

    expect(response.status).toBe(403)
  })

  it('returns paginated audit logs for admins', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin1',
      isAdmin: true,
      error: null,
    })
    vi.mocked(queryAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'audit_1',
          action: 'rsvp.confirmed',
          actorUid: 'user1',
          source: 'api',
          createdAt: '2024-06-01T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    })
    vi.mocked(countAuditLogs).mockResolvedValue(1)
    vi.mocked(enrichAuditLogsWithDisplayNames).mockImplementation(
      async (_db, logs) =>
        logs.map(log =>
          log.actorUid === 'user1'
            ? { ...log, actorDisplayName: 'Ada Lovelace' }
            : log
        )
    )

    const response = await GET(
      new NextRequest('http://localhost/api/audit?includeCount=true&limit=10')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      logs: [
        expect.objectContaining({
          id: 'audit_1',
          action: 'rsvp.confirmed',
          actorDisplayName: 'Ada Lovelace',
        }),
      ],
      nextCursor: null,
      totalCount: 1,
    })
    expect(queryAuditLogs).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10 })
    )
    expect(enrichAuditLogsWithDisplayNames).toHaveBeenCalled()
  })
})
