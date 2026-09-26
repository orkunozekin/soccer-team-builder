import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import { revokeInvite } from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  revokeInvite: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

describe('POST /api/clubs/[clubId]/invites/[inviteId]/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when a player tries to revoke an invite', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'player1',
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites/inv1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ clubId: 'c1', inviteId: 'inv1' }) }
    )

    expect(response.status).toBe(403)
    expect(revokeInvite).not.toHaveBeenCalled()
  })

  it('allows club admin to revoke an invite', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      isSuperUser: false,
      membership: null,
      error: null,
    })
    vi.mocked(revokeInvite).mockResolvedValue({
      id: 'inv1',
      clubId: 'c1',
      code: 'ABCD12',
      createdBy: 'admin1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: null,
      revokedAt: new Date(),
      createdAt: new Date(),
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites/inv1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ clubId: 'c1', inviteId: 'inv1' }) }
    )

    expect(response.status).toBe(200)
    expect(revokeInvite).toHaveBeenCalledWith({
      clubId: 'c1',
      inviteId: 'inv1',
    })
  })
})
