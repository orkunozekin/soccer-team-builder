import { describe, expect, it, vi, beforeEach } from 'vitest'
import { logUserError, userErrorResponse } from './logUserError'

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

import { auditLog } from '@/lib/services/auditService'

describe('logUserError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records failed outcome metadata via auditLog', () => {
    logUserError({
      action: 'check_in.failed',
      actorUid: 'user1',
      status: 403,
      message: 'Too far from field',
      code: 'DISTANCE',
      matchId: 'match1',
      entityType: 'rsvp',
    })

    expect(auditLog).toHaveBeenCalledWith({
      action: 'check_in.failed',
      actorUid: 'user1',
      matchId: 'match1',
      entityType: 'rsvp',
      source: 'api',
      metadata: {
        outcome: 'failed',
        status: 403,
        message: 'Too far from field',
        code: 'DISTANCE',
      },
    })
  })

  it('userErrorResponse logs and returns the given status', async () => {
    const response = userErrorResponse(
      {
        action: 'rsvp.failed',
        actorUid: 'user1',
        status: 400,
        message: 'Match ID required',
      },
      { error: 'Match ID required' }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Match ID required',
    })
    expect(auditLog).toHaveBeenCalledOnce()
  })
})
