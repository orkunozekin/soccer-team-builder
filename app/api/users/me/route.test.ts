import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { getActiveClubMembership, verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({
  verifyAuth: vi.fn(),
  getActiveClubMembership: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: { now: () => ({}) },
}))

describe('PATCH /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: null,
      email: null,
      error: 'Unauthorized',
    })

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'Alex' }),
      })
    )

    expect(response.status).toBe(401)
  })

  it('updates profile fields for the authenticated user', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'alex@example.com',
      error: null,
    })
    const updateMock = vi.fn()
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true }),
          update: updateMock,
        }),
      }),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: 'Alex',
          jerseyNumber: 7,
          position: 'MID',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Alex',
        jerseyNumber: 7,
        position: 'MID',
      })
    )
  })

  it('syncs email from the verified auth token', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'new@example.com',
      error: null,
    })
    const updateMock = vi.fn()
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true }),
          update: updateMock,
        }),
      }),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ syncEmail: true }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        emailLower: 'new@example.com',
      })
    )
  })

  it('rejects email sync when the token has no email', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: null,
      error: null,
    })

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ syncEmail: true }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Verified email is not available on this session',
    })
  })

  it('sets activeClubId when the user is an active member', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'alex@example.com',
      error: null,
    })
    vi.mocked(getActiveClubMembership).mockResolvedValue({
      membership: {
        id: 'club-a_user1',
        clubId: 'club-a',
        userId: 'user1',
        role: 'player',
        status: 'active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
      isSuperUser: false,
    })
    const updateMock = vi.fn()
    const clubGet = vi.fn().mockResolvedValue({ exists: true })
    const userGet = vi.fn().mockResolvedValue({ exists: true })
    vi.mocked(getAdminDb).mockReturnValue({
      collection: (name: string) => ({
        doc: () => ({
          get: name === 'clubs' ? clubGet : userGet,
          update: updateMock,
        }),
      }),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ activeClubId: 'club-a' }),
      })
    )

    expect(response.status).toBe(200)
    expect(getActiveClubMembership).toHaveBeenCalledWith('user1', 'club-a')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeClubId: 'club-a' })
    )
  })

  it('rejects activeClubId when the user is not a member', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'alex@example.com',
      error: null,
    })
    vi.mocked(getActiveClubMembership).mockResolvedValue({
      membership: null,
      isSuperUser: false,
    })
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true }),
          update: vi.fn(),
        }),
      }),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ activeClubId: 'other-club' }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'You are not a member of this club',
      code: 'not_club_member',
    })
  })

  it('clears activeClubId when null is sent', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'alex@example.com',
      error: null,
    })
    const updateMock = vi.fn()
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true }),
          update: updateMock,
        }),
      }),
    } as never)

    const response = await PATCH(
      new NextRequest('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ activeClubId: null }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeClubId: null })
    )
  })
})
