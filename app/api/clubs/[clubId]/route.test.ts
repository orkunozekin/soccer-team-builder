import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import { auditLog } from '@/lib/services/auditService'
import { updateClub } from '@/lib/services/clubService'

vi.mock('@/lib/api/auth', () => ({
  verifyAuth: vi.fn(),
  verifyClubAdmin: vi.fn(),
  verifyClubMember: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  getClub: vi.fn(),
  updateClub: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

const club = {
  id: 'c1',
  name: 'Alpha FC',
  slug: 'alpha',
  createdBy: 'admin1',
  settings: {
    allowPlayerInvites: false,
    branding: { displayName: 'Wolves', primaryColor: '#112233' },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
}

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/clubs/c1', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ clubId: 'c1' }) }
  )
}

describe('PATCH /api/clubs/[clubId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      isSuperUser: false,
      membership: null,
      error: null,
    })
    vi.mocked(updateClub).mockResolvedValue(club)
  })

  it('returns 403 when the caller is not a club admin', async () => {
    vi.mocked(verifyClubAdmin).mockResolvedValue({
      uid: 'player1',
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: null,
    })

    const response = await patch({
      settings: { branding: { primaryColor: '#112233' } },
    })

    expect(response.status).toBe(403)
    expect(updateClub).not.toHaveBeenCalled()
  })

  it('rejects an invalid color or logo before writing', async () => {
    const color = await patch({
      settings: { branding: { primaryColor: 'red' } },
    })
    expect(color.status).toBe(400)
    expect(await color.json()).toEqual({
      error: 'Primary color must be a #rrggbb hex color',
    })

    const logo = await patch({
      settings: { branding: { logoUrl: 'http://cdn.example/logo.png' } },
    })
    expect(logo.status).toBe(400)
    expect(await logo.json()).toEqual({
      error: 'Logo URL must be an https URL',
    })
    expect(updateClub).not.toHaveBeenCalled()
  })

  it('stores normalized branding without changing other settings keys', async () => {
    const response = await patch({
      settings: {
        branding: {
          displayName: '  Wolves ',
          logoUrl: 'https://cdn.example/logo.png',
          primaryColor: '#112233',
        },
      },
    })

    expect(response.status).toBe(200)
    expect(updateClub).toHaveBeenCalledWith('c1', {
      name: undefined,
      settings: {
        branding: {
          displayName: 'Wolves',
          logoUrl: 'https://cdn.example/logo.png',
          primaryColor: '#112233',
        },
      },
    })
    expect(auditLog).toHaveBeenCalled()
  })
})
