import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getAdminAuth } from '@/lib/firebase/admin'
import { sendPlunkEmail } from '@/lib/email/plunk'

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: vi.fn(),
}))

vi.mock('@/lib/email/plunk', () => ({
  sendPlunkEmail: vi.fn(),
}))

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BASE_URL = 'https://www.soccerville.club'
  })

  it('rejects invalid emails', async () => {
    const request = new NextRequest(
      'http://localhost/api/auth/password-reset',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      }
    )

    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Please enter a valid email address.',
    })
  })

  it('sends a branded Plunk email for known accounts', async () => {
    const generatePasswordResetLink = vi
      .fn()
      .mockResolvedValue(
        'https://soccerville.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc'
      )
    vi.mocked(getAdminAuth).mockReturnValue({
      generatePasswordResetLink,
    } as never)
    vi.mocked(sendPlunkEmail).mockResolvedValue(undefined)

    const request = new NextRequest(
      'http://localhost/api/auth/password-reset',
      {
        method: 'POST',
        body: JSON.stringify({ email: '  Me@Club.Test  ' }),
      }
    )

    const response = await POST(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })

    expect(generatePasswordResetLink).toHaveBeenCalledWith(
      'me@club.test',
      expect.objectContaining({
        url: 'https://www.soccerville.club/login',
      })
    )
    expect(sendPlunkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'me@club.test',
        subject: 'Reset your Soccerville password',
      })
    )
  })

  it('returns ok when the account does not exist', async () => {
    vi.mocked(getAdminAuth).mockReturnValue({
      generatePasswordResetLink: vi.fn().mockRejectedValue({
        code: 'auth/user-not-found',
      }),
    } as never)

    const request = new NextRequest(
      'http://localhost/api/auth/password-reset',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'missing@club.test' }),
      }
    )

    const response = await POST(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(sendPlunkEmail).not.toHaveBeenCalled()
  })
})
