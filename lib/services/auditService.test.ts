import { describe, expect, it, vi, beforeEach } from 'vitest'
import { recordAuditLog } from './auditService'

const mocks = vi.hoisted(() => {
  const setMock = vi.fn()
  const docMock = vi.fn(() => ({ set: setMock }))
  const collectionMock = vi.fn(() => ({ doc: docMock }))
  const getAdminDbMock = vi.fn()

  return { setMock, docMock, collectionMock, getAdminDbMock }
})

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: mocks.getAdminDbMock,
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: () => ({ _seconds: 1700000000 }),
  },
}))

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAdminDbMock.mockReturnValue({
      collection: mocks.collectionMock,
    })
  })

  it('writes an audit log document to auditLogs', async () => {
    const id = await recordAuditLog({
      action: 'rsvp.confirmed',
      actorUid: 'user1',
      matchId: 'match1',
      entityType: 'rsvp',
      entityId: 'rsvp1',
      source: 'api',
      metadata: { position: 'MID' },
    })

    expect(id).toMatch(/^audit_/)
    expect(mocks.collectionMock).toHaveBeenCalledWith('auditLogs')
    expect(mocks.setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rsvp.confirmed',
        actorUid: 'user1',
        matchId: 'match1',
        entityType: 'rsvp',
        entityId: 'rsvp1',
        source: 'api',
        metadata: { position: 'MID' },
      })
    )
  })

  it('returns null when Admin DB is unavailable', async () => {
    mocks.getAdminDbMock.mockReturnValue(null)

    const id = await recordAuditLog({
      action: 'auth.login',
      actorUid: 'user1',
      source: 'client',
    })

    expect(id).toBeNull()
    expect(mocks.setMock).not.toHaveBeenCalled()
  })
})
