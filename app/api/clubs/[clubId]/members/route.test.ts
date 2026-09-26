import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import {
  ensureClubNameLower,
  listMembershipsForClub,
} from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  ensureClubNameLower: vi.fn(),
  listMembershipsForClub: vi.fn(),
}))

describe('GET /api/clubs/[clubId]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for a player who is not club admin', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'player1',
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/c1/members'),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(403)
    expect(listMembershipsForClub).not.toHaveBeenCalled()
  })

  it('lists members for a club admin', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      isSuperUser: false,
      membership: null,
      error: null,
    })
    vi.mocked(ensureClubNameLower).mockResolvedValue(false)
    vi.mocked(listMembershipsForClub).mockResolvedValue([
      {
        id: 'c1_u2',
        clubId: 'c1',
        userId: 'u2',
        role: 'player',
        status: 'active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never)

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/c1/members'),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(200)
    expect(ensureClubNameLower).toHaveBeenCalledWith('c1')
    expect(listMembershipsForClub).toHaveBeenCalledWith('c1')
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.members).toHaveLength(1)
  })
})
