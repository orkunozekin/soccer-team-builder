import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { verifyCanCreateInvite, verifyClubAdmin } from '@/lib/api/auth'
import {
  createInvite,
  listActiveInvitesForClub,
} from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: vi.fn(),
  verifyCanCreateInvite: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  createInvite: vi.fn(),
  listActiveInvitesForClub: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

describe('GET /api/clubs/[clubId]/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for a player listing invites', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'player1',
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/c1/invites'),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(403)
    expect(listActiveInvitesForClub).not.toHaveBeenCalled()
  })

  it('lists invites for a club admin', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      isSuperUser: false,
      membership: null,
      error: null,
    })
    vi.mocked(listActiveInvitesForClub).mockResolvedValue([
      {
        id: 'inv1',
        clubId: 'c1',
        code: 'ABCD12',
        createdBy: 'admin1',
        createdByRole: 'club_admin',
        maxUses: null,
        useCount: 0,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      },
    ] as never)

    const response = await GET(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        headers: { origin: 'https://app.example' },
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invites[0].link).toBe('https://app.example/join?code=ABCD12')
  })
})

describe('POST /api/clubs/[clubId]/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when player invites are disabled', async () => {
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'player1',
      allowed: false,
      createdByRole: null,
      error: null,
    })

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(403)
    expect(createInvite).not.toHaveBeenCalled()
  })

  it('allows a player to create invites when permitted', async () => {
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'player1',
      allowed: true,
      createdByRole: 'player',
      error: null,
    })
    vi.mocked(createInvite).mockResolvedValue({
      id: 'inv2',
      clubId: 'c1',
      code: 'ZZZZ99',
      createdBy: 'player1',
      createdByRole: 'player',
      maxUses: null,
      useCount: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(201)
    expect(createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: 'c1',
        createdBy: 'player1',
        createdByRole: 'player',
      })
    )
  })
})
