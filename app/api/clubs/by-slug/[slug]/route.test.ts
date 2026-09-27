import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { verifyClubMember } from '@/lib/api/auth'
import { getClubBySlug } from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyClubMember: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  getClubBySlug: vi.fn(),
}))

describe('GET /api/clubs/by-slug/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the slug is unknown', async () => {
    vi.mocked(getClubBySlug).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/by-slug/missing'),
      { params: Promise.resolve({ slug: 'missing' }) }
    )

    expect(response.status).toBe(404)
    expect(verifyClubMember).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a member', async () => {
    vi.mocked(getClubBySlug).mockResolvedValue({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      createdBy: 'u1',
      settings: { allowPlayerInvites: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(verifyClubMember).mockResolvedValue({
      uid: 'u2',
      isMember: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/by-slug/alpha'),
      { params: Promise.resolve({ slug: 'alpha' }) }
    )

    expect(response.status).toBe(404)
  })

  it('returns the club for a member', async () => {
    vi.mocked(getClubBySlug).mockResolvedValue({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      createdBy: 'u1',
      settings: { allowPlayerInvites: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(verifyClubMember).mockResolvedValue({
      uid: 'u1',
      isMember: true,
      isSuperUser: false,
      membership: {
        id: 'm1',
        clubId: 'c1',
        userId: 'u1',
        role: 'player',
        status: 'active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
      error: null,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/by-slug/alpha'),
      { params: Promise.resolve({ slug: 'alpha' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.club).toEqual({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      settings: { allowPlayerInvites: false },
    })
  })
})
