import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getAuditLogRetentionDays,
  purgeExpiredAuditLogs,
} from './retention'

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

const mocks = vi.hoisted(() => {
  const commitMock = vi.fn()
  const deleteMock = vi.fn()
  const batchMock = vi.fn(() => ({ delete: deleteMock, commit: commitMock }))
  const getMock = vi.fn()
  const whereMock = vi.fn().mockReturnThis()
  const limitMock = vi.fn().mockReturnThis()
  const collectionMock = vi.fn(() => ({
    where: whereMock,
    limit: limitMock,
    get: getMock,
  }))

  return {
    commitMock,
    deleteMock,
    batchMock,
    getMock,
    collectionMock,
  }
})

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d, _date: d }),
  },
}))

describe('audit retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AUDIT_LOG_RETENTION_DAYS
    mocks.getMock.mockResolvedValue({ empty: true, size: 0, docs: [] })
  })

  it('defaults retention to 90 days', () => {
    expect(getAuditLogRetentionDays()).toBe(90)
  })

  it('respects AUDIT_LOG_RETENTION_DAYS when valid', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30'
    expect(getAuditLogRetentionDays()).toBe(30)
  })

  it('deletes expired audit logs in batches', async () => {
    mocks.getMock
      .mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [{ ref: { id: 'a1' } }, { ref: { id: 'a2' } }],
      })
      .mockResolvedValueOnce({ empty: true, size: 0, docs: [] })

    const adminDb = {
      collection: mocks.collectionMock,
      batch: mocks.batchMock,
    } as never

    const result = await purgeExpiredAuditLogs(adminDb)

    expect(result.deleted).toBe(2)
    expect(result.retentionDays).toBe(90)
    expect(mocks.commitMock).toHaveBeenCalledTimes(1)
  })
})
