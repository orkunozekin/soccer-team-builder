import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from './route'
import { verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import {
  getSkillAssessment,
  saveSkillAssessment,
} from '@/lib/skill/skillStoreAdmin'

vi.mock('@/lib/api/auth', () => ({ verifyAuth: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/flags/evaluateFeatureFlag', () => ({
  evaluateFeatureFlag: vi.fn(),
}))
vi.mock('@/lib/skill/skillStoreAdmin', () => ({
  getSkillAssessment: vi.fn(),
  saveSkillAssessment: vi.fn(),
}))

const URL = 'http://localhost/api/users/me/skill-assessment'
const answers = { firstTouch: 2, passing: 3, fitness: 1, gameSense: 2 }

function putRequest(body: unknown) {
  return new NextRequest(URL, { method: 'PUT', body: JSON.stringify(body) })
}

describe('/api/users/me/skill-assessment', () => {
  const adminDb = { tag: 'db' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'user1',
      email: 'u@example.com',
      error: null,
    })
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
  })

  it('returns 401 without a verified user', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: null,
      email: null,
      error: 'No authorization token provided',
    })
    expect((await GET(new NextRequest(URL))).status).toBe(401)
    expect((await PUT(putRequest({ answers }))).status).toBe(401)
    expect(saveSkillAssessment).not.toHaveBeenCalled()
  })

  it('rejects the fallback uid', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      uid: 'fallback',
      email: null,
      error: null,
    })
    expect((await PUT(putRequest({ answers }))).status).toBe(401)
    expect(saveSkillAssessment).not.toHaveBeenCalled()
  })

  it('returns 403 when the flag is off', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(false)
    expect((await GET(new NextRequest(URL))).status).toBe(403)
    expect((await PUT(putRequest({ answers }))).status).toBe(403)
    expect(evaluateFeatureFlag).toHaveBeenCalledWith('skill-balanced-teams', {
      key: 'user1',
      email: 'u@example.com',
    })
    expect(getSkillAssessment).not.toHaveBeenCalled()
    expect(saveSkillAssessment).not.toHaveBeenCalled()
  })

  it('returns the stored assessment, or null', async () => {
    vi.mocked(getSkillAssessment).mockResolvedValueOnce({
      answers,
      updatedAt: '2026-11-05T12:00:00.000Z',
    } as never)
    const res = await GET(new NextRequest(URL))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      assessment: { answers, updatedAt: '2026-11-05T12:00:00.000Z' },
    })
    expect(getSkillAssessment).toHaveBeenCalledWith(adminDb, 'user1')

    vi.mocked(getSkillAssessment).mockResolvedValueOnce(null)
    await expect((await GET(new NextRequest(URL))).json()).resolves.toEqual({
      assessment: null,
    })
  })

  it.each([
    ['missing answers', {}],
    ['out of range', { answers: { ...answers, passing: 4 } }],
    ['missing key', { answers: { firstTouch: 1, passing: 1, fitness: 1 } }],
    ['extra key', { answers: { ...answers, extra: 1 } }],
  ])('returns 400 for %s', async (_label, body) => {
    expect((await PUT(putRequest(body))).status).toBe(400)
    expect(saveSkillAssessment).not.toHaveBeenCalled()
  })

  it('saves valid answers for the caller', async () => {
    vi.mocked(saveSkillAssessment).mockResolvedValue({
      answers,
      updatedAt: '2026-11-05T12:00:00.000Z',
    } as never)
    const res = await PUT(putRequest({ answers, userId: 'someone-else' }))
    expect(res.status).toBe(200)
    expect(saveSkillAssessment).toHaveBeenCalledWith(adminDb, 'user1', answers)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      assessment: { answers },
    })
  })

  it('sanitizes store errors', async () => {
    vi.mocked(saveSkillAssessment).mockRejectedValue(
      new Error('7 PERMISSION_DENIED: firestore internals')
    )
    const res = await PUT(putRequest({ answers }))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to save skill questionnaire',
    })
  })
})
