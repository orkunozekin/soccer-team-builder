import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enrichAuditLogsWithDisplayNames } from './enrichAuditLogNames'
import type { AuditLog } from '@/types/auditLog'

describe('enrichAuditLogsWithDisplayNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('attaches actor and target display names from users collection', async () => {
    const getAll = vi.fn().mockResolvedValue([
      {
        id: 'user1',
        exists: true,
        data: () => ({ displayName: 'Ada Lovelace' }),
      },
      {
        id: 'user2',
        exists: true,
        data: () => ({ displayName: 'Grace Hopper' }),
      },
    ])
    const doc = vi.fn((id: string) => ({ id }))
    const collection = vi.fn(() => ({ doc }))
    const adminDb = { collection, getAll } as never

    const logs: AuditLog[] = [
      {
        id: 'audit_1',
        action: 'check_in.host',
        actorUid: 'user1',
        targetUid: 'user2',
        source: 'api',
        createdAt: '2024-06-01T12:00:00.000Z',
      },
    ]

    const enriched = await enrichAuditLogsWithDisplayNames(adminDb, logs)

    expect(collection).toHaveBeenCalledWith('users')
    expect(getAll).toHaveBeenCalledOnce()
    expect(enriched[0]).toMatchObject({
      actorDisplayName: 'Ada Lovelace',
      targetDisplayName: 'Grace Hopper',
    })
  })

  it('skips system actors and returns logs unchanged when no users resolve', async () => {
    const getAll = vi.fn()
    const adminDb = {
      collection: vi.fn(() => ({ doc: vi.fn() })),
      getAll,
    } as never

    const logs: AuditLog[] = [
      {
        id: 'audit_1',
        action: 'cron.audit_retention',
        actorUid: 'system',
        source: 'cron',
        createdAt: '2024-06-01T12:00:00.000Z',
      },
    ]

    const enriched = await enrichAuditLogsWithDisplayNames(adminDb, logs)

    expect(getAll).not.toHaveBeenCalled()
    expect(enriched).toEqual(logs)
  })
})
