import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { verifySuperUser } from '@/lib/api/auth'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { createClub } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

vi.mock('@/lib/api/auth', () => ({
  verifySuperUser: vi.fn(),
}))

vi.mock('@/lib/flags/evaluateFeatureFlag', () => ({
  evaluateFeatureFlag: vi.fn(),
}))

vi.mock('@/lib/services/clubService', () => ({
  createClub: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

describe('POST /api/clubs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifySuperUser).mockResolvedValue({
      uid: 'su1',
      email: 'su@example.com',
      isSuperUser: true,
      error: null,
    })
  })

  it('returns 403 when club-creation flag is off', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(false)

    const response = await POST(
      new NextRequest('http://localhost/api/clubs', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Club' }),
        headers: { 'Content-Type': 'application/json' },
      })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Club creation is unavailable')
    expect(createClub).not.toHaveBeenCalled()
    expect(evaluateFeatureFlag).toHaveBeenCalledWith('club-creation', {
      key: 'su1',
      email: 'su@example.com',
    })
  })

  it('creates a club when club-creation flag is on', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    vi.mocked(createClub).mockResolvedValue({
      id: 'c1',
      name: 'New Club',
      slug: 'new-club',
      createdBy: 'su1',
      settings: { allowPlayerInvites: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)

    const response = await POST(
      new NextRequest('http://localhost/api/clubs', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Club' }),
        headers: { 'Content-Type': 'application/json' },
      })
    )

    expect(response.status).toBe(201)
    expect(createClub).toHaveBeenCalledWith({
      name: 'New Club',
      createdBy: 'su1',
      settings: undefined,
    })
    expect(auditLog).toHaveBeenCalled()
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.club.id).toBe('c1')
  })
})
