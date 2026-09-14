import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({
  verifyAuth: vi.fn(),
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
})
