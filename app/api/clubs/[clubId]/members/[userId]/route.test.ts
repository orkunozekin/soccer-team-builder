import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import { getClubMemberProfile } from '@/lib/clubs/clubMemberProfile'
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

vi.mock('@/lib/clubs/clubMemberProfile', () => ({
  getClubMemberProfile: vi.fn(),
}))

describe('GET /api/clubs/[clubId]/members/[userId]', () => {
  const get = () =>
    GET(new NextRequest('http://localhost/api/clubs/c1/members/u2'), {
      params: Promise.resolve({ clubId: 'c1', userId: 'u2' }),
    })

  const asClubAdmin = (isClubAdmin: boolean) =>
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'viewer',
      isClubAdmin,
      isSuperUser: false,
      membership: null,
      error: null,
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for players without loading the profile', async () => {
    asClubAdmin(false)
    const response = await get()
    expect(response.status).toBe(403)
    expect(getClubMemberProfile).not.toHaveBeenCalled()
  })

  it('returns 404 when the user is not an active member of the club', async () => {
    asClubAdmin(true)
    vi.mocked(getClubMemberProfile).mockResolvedValue(null)
    const response = await get()
    expect(response.status).toBe(404)
    expect(getClubMemberProfile).toHaveBeenCalledWith('c1', 'u2')
  })

  it('returns the club-scoped profile to club admins', async () => {
    asClubAdmin(true)
    vi.mocked(getClubMemberProfile).mockResolvedValue({
      member: {
        userId: 'u2',
        displayName: 'Sam',
        email: 'sam@example.com',
        jerseyNumber: 9,
        position: 'ST',
        clubRole: 'player',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      rsvps: [],
      matches: [],
    })
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.member.displayName).toBe('Sam')
  })
})

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
