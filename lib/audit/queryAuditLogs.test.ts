import { Timestamp } from 'firebase-admin/firestore'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { countAuditLogs, queryAuditLogs } from './queryAuditLogs'

const mocks = vi.hoisted(() => {
  const getMock = vi.fn()
  const countGetMock = vi.fn()
  const collectionMock = vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    count: vi.fn(() => ({ get: countGetMock })),
    get: getMock,
  }))

  return { getMock, countGetMock, collectionMock }
})

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}))

describe('queryAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps audit log documents and returns next cursor', async () => {
    const createdAt = Timestamp.fromDate(new Date('2024-06-01T12:00:00.000Z'))
    mocks.getMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'audit_1',
          data: () => ({
            action: 'rsvp.confirmed',
            actorUid: 'user1',
            source: 'api',
            matchId: 'match1',
            createdAt,
          }),
        },
        {
          id: 'audit_2',
          data: () => ({
            action: 'auth.login',
            actorUid: 'user2',
            source: 'client',
            createdAt,
          }),
        },
      ],
    })

    const adminDb = { collection: mocks.collectionMock } as never
    const result = await queryAuditLogs(adminDb, { limit: 1 })

    expect(result.logs).toHaveLength(1)
    expect(result.logs[0]).toMatchObject({
      id: 'audit_1',
      action: 'rsvp.confirmed',
      actorUid: 'user1',
      matchId: 'match1',
    })
    expect(result.nextCursor).toBe('2024-06-01T12:00:00.000Z')
  })

  it('counts filtered audit logs', async () => {
    mocks.countGetMock.mockResolvedValueOnce({ data: () => ({ count: 42 }) })

    const adminDb = { collection: mocks.collectionMock } as never
    const count = await countAuditLogs(adminDb, { source: 'api' })

    expect(count).toBe(42)
  })
})
