import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { previewInviteByCode } from '@/lib/services/clubService'

vi.mock('@/lib/services/clubService', () => ({
  previewInviteByCode: vi.fn(),
}))

describe('GET /api/invites/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a code', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/invites/preview')
    )
    expect(response.status).toBe(400)
  })

  it('returns club name for a valid invite', async () => {
    vi.mocked(previewInviteByCode).mockResolvedValue({
      clubId: 'club-a',
      clubName: 'Jax State Soccer Club',
    })

    const response = await GET(
      new NextRequest('http://localhost/api/invites/preview?code=ABCD12')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      clubId: 'club-a',
      clubName: 'Jax State Soccer Club',
    })
    expect(previewInviteByCode).toHaveBeenCalledWith('ABCD12')
  })

  it('returns 404 for invalid codes', async () => {
    vi.mocked(previewInviteByCode).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('http://localhost/api/invites/preview?code=BAD')
    )

    expect(response.status).toBe(404)
  })
})
