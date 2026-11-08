import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getClubSkillRanking,
  getEffectiveSkillScoresForClub,
  getSkillAnswersForUsers,
  getSkillAssessment,
  saveClubSkillRanking,
} from './skillStoreAdmin'
import { DEFAULT_SKILL } from '@/lib/skill/scoring'

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: () => ({ toDate: () => new Date('2026-11-05T12:00:00.000Z') }),
  },
}))

type Store = Record<string, Record<string, Record<string, unknown>>>

function makeSnap(id: string, data: Record<string, unknown> | undefined) {
  return { id, exists: data !== undefined, data: () => data }
}

function createDb(store: Store) {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = []
  const getAllCalls: number[] = []
  const ref = (collection: string, id: string) => ({
    id,
    collection,
    get: async () => makeSnap(id, store[collection]?.[id]),
    set: async (data: Record<string, unknown>) => {
      writes.push({ path: `${collection}/${id}`, data })
      store[collection] = { ...(store[collection] ?? {}), [id]: data }
    },
  })
  const adminDb = {
    collection: (collection: string) => ({
      doc: (id: string) => ref(collection, id),
    }),
    getAll: async (...refs: Array<{ id: string; collection: string }>) => {
      getAllCalls.push(refs.length)
      return refs.map(r => makeSnap(r.id, store[r.collection]?.[r.id]))
    },
    runTransaction: async <T>(
      fn: (tx: {
        get: (r: ReturnType<typeof ref>) => Promise<unknown>
        set: (r: ReturnType<typeof ref>, data: Record<string, unknown>) => void
      }) => Promise<T>
    ): Promise<T> => {
      const pending: Array<() => Promise<void>> = []
      const result = await fn({
        get: r => r.get(),
        set: (r, data) => {
          pending.push(() => r.set(data))
        },
      })
      for (const write of pending) await write()
      return result
    },
  }
  return { adminDb: adminDb as never, writes, getAllCalls }
}

const answers = { firstTouch: 3, passing: 3, fitness: 3, gameSense: 3 }

describe('skillStoreAdmin', () => {
  let ratings: Record<string, number>

  beforeEach(() => {
    ratings = { a: 9, b: 4 }
  })

  it('returns null for a missing or malformed assessment', async () => {
    const { adminDb } = createDb({
      skillAssessments: { bad: { answers: { firstTouch: 9 } } },
    })
    await expect(getSkillAssessment(adminDb, 'none')).resolves.toBeNull()
    await expect(getSkillAssessment(adminDb, 'bad')).resolves.toBeNull()
  })

  it('reads answers for many uids in chunks of 100', async () => {
    const docs: Record<string, Record<string, unknown>> = {}
    const ids = Array.from({ length: 150 }, (_, i) => `u${i}`)
    for (const id of ids) docs[id] = { answers }
    docs.u1 = { answers: { nope: 1 } }
    const { adminDb, getAllCalls } = createDb({ skillAssessments: docs })

    const result = await getSkillAnswersForUsers(adminDb, [...ids, 'u0'])
    expect(getAllCalls).toEqual([100, 50])
    expect(result.size).toBe(149)
    expect(result.has('u1')).toBe(false)
  })

  it('returns no ratings and version 0 when the club has none', async () => {
    const { adminDb } = createDb({})
    await expect(getClubSkillRanking(adminDb, 'club1')).resolves.toEqual({
      ratings: {},
      version: 0,
    })
  })

  it('reads a doc saved by the old tier ranking as unrated, keeping its version', async () => {
    const { adminDb } = createDb({
      clubSkillRankings: { club1: { tiers: { top: ['a'] }, version: 3 } },
    })
    await expect(getClubSkillRanking(adminDb, 'club1')).resolves.toEqual({
      ratings: {},
      version: 3,
    })
  })

  it('drops uids outside the allowed set when reading', async () => {
    const { adminDb } = createDb({
      clubSkillRankings: { club1: { ratings, version: 3 } },
    })
    const ranking = await getClubSkillRanking(adminDb, 'club1', new Set(['b']))
    expect(ranking).toEqual({ ratings: { b: 4 }, version: 3 })
  })

  it('saves the first ratings at expected version 0', async () => {
    const { adminDb, writes } = createDb({})
    const result = await saveClubSkillRanking(adminDb, {
      clubId: 'club1',
      ratings: ratings as never,
      expectedVersion: 0,
      updatedBy: 'admin1',
    })
    expect(result).toEqual({ ok: true, version: 1 })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      path: 'clubSkillRankings/club1',
      data: { clubId: 'club1', ratings, version: 1, updatedBy: 'admin1' },
    })
  })

  it('increments the version when the expected version matches', async () => {
    const { adminDb } = createDb({
      clubSkillRankings: { club1: { ratings: {}, version: 4 } },
    })
    const result = await saveClubSkillRanking(adminDb, {
      clubId: 'club1',
      ratings: ratings as never,
      expectedVersion: 4,
      updatedBy: 'admin1',
    })
    expect(result).toEqual({ ok: true, version: 5 })
  })

  it('returns a conflict and writes nothing on a stale version', async () => {
    const { adminDb, writes } = createDb({
      clubSkillRankings: { club1: { ratings: {}, version: 2 } },
    })
    const result = await saveClubSkillRanking(adminDb, {
      clubId: 'club1',
      ratings: ratings as never,
      expectedVersion: 1,
      updatedBy: 'admin1',
    })
    expect(result).toEqual({ ok: false, conflict: true, currentVersion: 2 })
    expect(writes).toHaveLength(0)
  })

  it('scores rated players by their rating and ignores the questionnaire', async () => {
    const { adminDb } = createDb({
      clubSkillRankings: { club1: { ratings, version: 1 } },
      skillAssessments: { c: { answers } },
    })
    const result = await getEffectiveSkillScoresForClub(adminDb, 'club1', [
      'a',
      'c',
      'd',
    ])
    expect(result.scoreByUserId.get('a')).toBe(9)
    expect(result.scoreByUserId.get('c')).toBe(DEFAULT_SKILL)
    expect(result.scoreByUserId.get('d')).toBe(DEFAULT_SKILL)
    expect(result.unratedUserIds).toEqual(['c', 'd'])
  })
})
