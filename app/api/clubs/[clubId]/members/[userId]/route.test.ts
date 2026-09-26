import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import { updateMembershipRole } from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  updateMembershipRole: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

describe('PATCH /api/clubs/[clubId]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when a player tries to promote or demote', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'player1',
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await PATCH(
      new NextRequest('http://localhost/api/clubs/c1/members/u2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'club_admin' }),
      }),
      { params: Promise.resolve({ clubId: 'c1', userId: 'u2' }) }
    )

    expect(response.status).toBe(403)
    expect(updateMembershipRole).not.toHaveBeenCalled()
  })

  it('allows club admin to update another member role', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      isSuperUser: false,
      membership: null,
      error: null,
    })
    vi.mocked(updateMembershipRole).mockResolvedValue({
      id: 'c1_u2',
      clubId: 'c1',
      userId: 'u2',
      role: 'club_admin',
      status: 'active',
      joinedAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/clubs/c1/members/u2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'club_admin' }),
      }),
      { params: Promise.resolve({ clubId: 'c1', userId: 'u2' }) }
    )

    expect(response.status).toBe(200)
    expect(updateMembershipRole).toHaveBeenCalledWith({
      clubId: 'c1',
      userId: 'u2',
      role: 'club_admin',
    })
  })
})
