import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from './route'
import { verifyClubAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { auditLog } from '@/lib/services/auditService'
import { listMembershipsForClub } from '@/lib/services/clubService'
import {
  getClubSkillRanking,
  saveClubSkillRanking,
} from '@/lib/skill/skillStoreAdmin'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'

vi.mock('@/lib/api/auth', () => ({ verifyClubAdmin: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/flags/evaluateFeatureFlag', () => ({
  evaluateFeatureFlag: vi.fn(),
}))
vi.mock('@/lib/services/auditService', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/services/clubService', () => ({
  listMembershipsForClub: vi.fn(),
}))
vi.mock('@/lib/users/getUsersByIdsAdmin', () => ({
  getUsersByIdsAdmin: vi.fn(),
}))
vi.mock('@/lib/skill/skillStoreAdmin', () => ({
  getClubSkillRanking: vi.fn(),
  saveClubSkillRanking: vi.fn(),
}))

const URL = 'http://localhost/api/clubs/club1/skill-ranking'
const context = () => ({ params: Promise.resolve({ clubId: 'club1' }) })

function adminResult(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'admin1',
    email: 'admin@example.com',
    isClubAdmin: true,
    isSuperUser: false,
    membership: null,
    error: null,
    ...overrides,
  }
}

function putRequest(body: unknown) {
  return new NextRequest(URL, { method: 'PUT', body: JSON.stringify(body) })
}

const memberships = [
  { userId: 'a', displayName: 'Alex' },
  { userId: 'b', displayName: 'Blair' },
]

describe('/api/clubs/[clubId]/skill-ranking', () => {
  const adminDb = { tag: 'db' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyClubAdmin).mockResolvedValue(adminResult() as never)
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
    vi.mocked(listMembershipsForClub).mockResolvedValue(memberships as never)
  })

  describe('authorization', () => {
    it('returns 401 without a uid', async () => {
      vi.mocked(verifyClubAdmin).mockResolvedValue(
        adminResult({
          uid: null,
          isClubAdmin: false,
          error: 'Invalid or expired token',
        }) as never
      )
      expect((await GET(new NextRequest(URL), context())).status).toBe(401)
      expect((await PUT(putRequest({}), context())).status).toBe(401)
    })

    it('returns 503 (retryable) when the membership lookup fails', async () => {
      vi.mocked(verifyClubAdmin).mockResolvedValue(
        adminResult({
          isClubAdmin: false,
          error: 'Failed to verify club membership',
        }) as never
      )
      const res = await GET(new NextRequest(URL), context())
      expect(res.status).toBe(503)
      expect((await PUT(putRequest({}), context())).status).toBe(503)
      expect(listMembershipsForClub).not.toHaveBeenCalled()
    })

    it('returns 403 for non-admins', async () => {
      vi.mocked(verifyClubAdmin).mockResolvedValue(
        adminResult({ isClubAdmin: false }) as never
      )
      expect((await GET(new NextRequest(URL), context())).status).toBe(403)
      expect((await PUT(putRequest({}), context())).status).toBe(403)
      expect(evaluateFeatureFlag).not.toHaveBeenCalled()
    })

    it('returns 403 when the flag is off', async () => {
      vi.mocked(evaluateFeatureFlag).mockResolvedValue(false)
      const res = await GET(new NextRequest(URL), context())
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toEqual({
        error: 'Skill ranking is unavailable',
      })
      expect((await PUT(putRequest({}), context())).status).toBe(403)
      expect(evaluateFeatureFlag).toHaveBeenCalledWith('skill-balanced-teams', {
        key: 'admin1',
        email: 'admin@example.com',
      })
      expect(listMembershipsForClub).not.toHaveBeenCalled()
    })

    it('checks admin rights for the club in the URL', async () => {
      await GET(new NextRequest(URL), context())
      expect(verifyClubAdmin).toHaveBeenCalledWith(expect.anything(), 'club1')
    })
  })

  describe('GET', () => {
    it('returns the ratings and the active members', async () => {
      const ratings = { b: 7 } as const
      vi.mocked(getClubSkillRanking).mockResolvedValue({ ratings, version: 3 })
      vi.mocked(getUsersByIdsAdmin).mockResolvedValue([
        { uid: 'a', position: 'MID' },
        { uid: 'b', position: null },
      ] as never)

      const res = await GET(new NextRequest(URL), context())
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        ranking: { ratings, version: 3 },
        members: [
          { userId: 'a', displayName: 'Alex', position: 'MID' },
          { userId: 'b', displayName: 'Blair', position: null },
        ],
      })
      // Former members are dropped by reading with the active-member set.
      expect(getClubSkillRanking).toHaveBeenCalledWith(
        adminDb,
        'club1',
        new Set(['a', 'b'])
      )
    })

    it('returns a sanitized 500 when members fail to load', async () => {
      vi.mocked(listMembershipsForClub).mockRejectedValue(
        new Error('14 UNAVAILABLE: firestore down')
      )
      const res = await GET(new NextRequest(URL), context())
      expect(res.status).toBe(500)
      await expect(res.json()).resolves.toEqual({
        error: 'Failed to load skill ranking',
      })
    })
  })

  describe('PUT', () => {
    const ratings = { a: 9, b: 2 }

    it.each([
      ['missing version', { ratings }],
      ['negative version', { ratings, version: -1 }],
      ['fractional version', { ratings, version: 1.5 }],
      ['missing ratings', { version: 0 }],
      ['non-member uid', { ratings: { ...ratings, x: 5 }, version: 0 }],
      ['rating above 10', { ratings: { a: 11 }, version: 0 }],
      ['rating below 1', { ratings: { a: 0 }, version: 0 }],
      ['fractional rating', { ratings: { a: 6.5 }, version: 0 }],
    ])('returns 400 for %s', async (_label, body) => {
      expect((await PUT(putRequest(body), context())).status).toBe(400)
      expect(saveClubSkillRanking).not.toHaveBeenCalled()
      expect(auditLog).not.toHaveBeenCalled()
    })

    it('returns 409 with a clear message on a version conflict', async () => {
      vi.mocked(saveClubSkillRanking).mockResolvedValue({
        ok: false,
        conflict: true,
        currentVersion: 5,
      })
      const res = await PUT(putRequest({ ratings, version: 4 }), context())
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error:
          'Another admin changed the ratings. Reload to see their changes.',
        code: 'version_conflict',
      })
      expect(auditLog).not.toHaveBeenCalled()
    })

    it('saves, audits counts only, and returns the new version', async () => {
      vi.mocked(saveClubSkillRanking).mockResolvedValue({
        ok: true,
        version: 5,
      })
      const res = await PUT(putRequest({ ratings, version: 4 }), context())
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        success: true,
        ranking: { ratings, version: 5 },
      })
      expect(saveClubSkillRanking).toHaveBeenCalledWith(adminDb, {
        clubId: 'club1',
        ratings,
        expectedVersion: 4,
        updatedBy: 'admin1',
      })
      expect(auditLog).toHaveBeenCalledWith({
        action: 'club.skill_ranking_updated',
        actorUid: 'admin1',
        entityType: 'club',
        entityId: 'club1',
        source: 'api',
        metadata: {
          ratedCount: 2,
          version: 5,
        },
      })
    })
  })
})
