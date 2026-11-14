import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { verifyClubMember } from '@/lib/api/auth'
import {
  clubRequiresCodeOfConduct,
  getCodeOfConductAgreement,
} from '@/lib/conduct/conductStoreAdmin'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({ verifyClubMember: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/conduct/conductStoreAdmin', () => ({
  clubRequiresCodeOfConduct: vi.fn(),
  getCodeOfConductAgreement: vi.fn(),
}))

const get = (clubId?: string) =>
  GET(
    new NextRequest(
      `http://localhost/api/users/me/code-of-conduct${
        clubId ? `?clubId=${clubId}` : ''
      }`
    )
  )

const member = {
  uid: 'user1',
  email: null,
  isMember: true,
  isSuperUser: false,
  membership: null,
  error: null,
}

describe('GET /api/users/me/code-of-conduct', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyClubMember).mockResolvedValue(member)
    vi.mocked(getAdminDb).mockReturnValue({} as never)
    vi.mocked(clubRequiresCodeOfConduct).mockResolvedValue(true)
    vi.mocked(getCodeOfConductAgreement).mockResolvedValue(null)
  })

  it('returns 401 without a verified user', async () => {
    vi.mocked(verifyClubMember).mockResolvedValue({
      ...member,
      uid: null,
      isMember: false,
      error: 'No authorization token provided',
    })
    expect((await get('c1')).status).toBe(401)
  })

  it('returns 404 to non-members without revealing the setting', async () => {
    vi.mocked(verifyClubMember).mockResolvedValue({
      ...member,
      isMember: false,
    })
    const res = await get('c1')
    expect(res.status).toBe(404)
    expect(clubRequiresCodeOfConduct).not.toHaveBeenCalled()
  })

  it('returns a retryable 500 when the membership lookup fails', async () => {
    vi.mocked(verifyClubMember).mockResolvedValue({
      ...member,
      isMember: false,
      error: 'Failed to verify club membership',
    })
    expect((await get('c1')).status).toBe(500)
  })

  it('is required when the club opted in and the member has not agreed', async () => {
    const res = await get('c1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ required: true, agreement: null })
    expect(clubRequiresCodeOfConduct).toHaveBeenCalledWith({}, 'c1')
  })

  it('is not required once the member agreed', async () => {
    const agreement = {
      version: '2026-11-14',
      agreedAt: '2026-11-14T00:00:00Z',
    }
    vi.mocked(getCodeOfConductAgreement).mockResolvedValue(agreement)
    expect(await (await get('c1')).json()).toEqual({
      required: false,
      agreement,
    })
  })

  it('is not required when the club has not opted in', async () => {
    vi.mocked(clubRequiresCodeOfConduct).mockResolvedValue(false)
    expect(await (await get('c1')).json()).toEqual({
      required: false,
      agreement: null,
    })
  })

  it('without a clubId, returns only the agreement', async () => {
    const res = await get()
    expect(await res.json()).toEqual({ required: false, agreement: null })
    expect(clubRequiresCodeOfConduct).not.toHaveBeenCalled()
  })

  it('does not leak raw errors', async () => {
    vi.mocked(getCodeOfConductAgreement).mockRejectedValue(
      new Error('FAILED_PRECONDITION: internal detail')
    )
    const res = await get('c1')
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('internal detail')
  })
})
