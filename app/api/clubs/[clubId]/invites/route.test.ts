import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { verifyCanCreateInvite, verifyClubAdmin } from '@/lib/api/auth'
import {
  InviteQuotaExceededError,
  createInvite,
  listActiveInvitesForClub,
  recordInviteExpiryMessageId,
} from '@/lib/services/clubService'
import { scheduleInviteExpiry } from '@/lib/services/inviteExpiryQueue'

vi.mock('@/lib/services/inviteExpiryQueue', () => ({
  scheduleInviteExpiry: vi.fn(),
}))

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: vi.fn(),
  verifyCanCreateInvite: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  createInvite: vi.fn(),
  listActiveInvitesForClub: vi.fn(),
  recordInviteExpiryMessageId: vi.fn(),
  InviteQuotaExceededError: class InviteQuotaExceededError extends Error {
    constructor(public readonly nextAllowedAt: Date) {
      super('limited')
    }
  },
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

  it('ignores a client-sent expiresAt', async () => {
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'admin1',
      allowed: true,
      createdByRole: 'club_admin',
      error: null,
    })
    vi.mocked(createInvite).mockResolvedValue({
      id: 'inv3',
      clubId: 'c1',
      code: 'YYYY88',
      createdBy: 'admin1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z' }),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(201)
    expect(vi.mocked(createInvite).mock.calls[0][0]).not.toHaveProperty(
      'expiresAt'
    )
  })

  it('schedules expiry and records the QStash message id', async () => {
    const expiresAt = new Date('2026-10-01T05:00:00Z')
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'admin1',
      allowed: true,
      createdByRole: 'club_admin',
      error: null,
    })
    vi.mocked(createInvite).mockResolvedValue({
      id: 'inv4',
      clubId: 'c1',
      code: 'XXXX77',
      createdBy: 'admin1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(scheduleInviteExpiry).mockResolvedValue('msg_1')

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(201)
    expect(scheduleInviteExpiry).toHaveBeenCalledWith({
      inviteId: 'inv4',
      expiresAt,
    })
    expect(recordInviteExpiryMessageId).toHaveBeenCalledWith('inv4', 'msg_1')
  })

  it('still returns 201 when scheduling expiry fails', async () => {
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'admin1',
      allowed: true,
      createdByRole: 'club_admin',
      error: null,
    })
    vi.mocked(createInvite).mockResolvedValue({
      id: 'inv5',
      clubId: 'c1',
      code: 'WWWW66',
      createdBy: 'admin1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    } as never)
    vi.mocked(scheduleInviteExpiry).mockRejectedValue(new Error('qstash down'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(201)
    expect(recordInviteExpiryMessageId).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('returns 429 with nextAllowedAt when a player is limited', async () => {
    const nextAllowedAt = new Date('2026-09-30T23:00:00Z')
    vi.mocked(verifyCanCreateInvite).mockResolvedValue({
      uid: 'player1',
      allowed: true,
      createdByRole: 'player',
      error: null,
    })
    vi.mocked(createInvite).mockRejectedValue(
      new InviteQuotaExceededError(nextAllowedAt)
    )

    const response = await POST(
      new NextRequest('http://localhost/api/clubs/c1/invites', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clubId: 'c1' }) }
    )

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toBe('You can create one invite every 11 hours.')
    expect(body.nextAllowedAt).toBe(nextAllowedAt.toISOString())
  })
})
