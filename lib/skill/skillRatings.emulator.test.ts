// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '@/app/api/clubs/[clubId]/skill-ranking/route'
import { POST as rebalance } from '@/app/api/teams/rebalance/route'
import { getAdminDb } from '@/lib/firebase/admin'

// Real Firestore (emulator) for storage, ratings and rebalance; only auth and
// the audit log are stubbed. The flag comes from the local override env.
vi.mock('@/lib/api/auth', () => ({
  verifyClubAdmin: async () => ({
    uid: 'admin1',
    email: 'admin@example.com',
    isClubAdmin: true,
    isSuperUser: false,
    membership: null,
    error: null,
  }),
  verifyClubAdminForMatch: async (_req: NextRequest, matchId: string) => ({
    uid: 'admin1',
    email: 'admin@example.com',
    isClubAdmin: true,
    isSuperUser: false,
    matchExists: true,
    clubId: matchId.split('__')[0],
    error: null,
  }),
}))
vi.mock('@/lib/services/auditService', () => ({ auditLog: vi.fn() }))

// Opt in only to the loopback emulator, never a configured remote database.
const emulator =
  process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-skill-ratings' &&
  process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS === 'true'

describe.skipIf(!emulator)('Admin 1–10 ratings on Firestore emulator', () => {
  let db: Firestore
  let clubId: string
  let matchId: string
  let ids: string[]

  const context = () => ({ params: Promise.resolve({ clubId }) })
  const url = () => `http://localhost/api/clubs/${clubId}/skill-ranking`
  const put = (body: object) =>
    PUT(
      new NextRequest(url(), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      context()
    )
  const teams = async () =>
    (await db.collection(`matches/${matchId}/teams`).get()).docs
      .map(d => d.data())
      .sort((a, b) => a.teamNumber - b.teamNumber)
      .map(t => t.playerIds as string[])

  beforeEach(async () => {
    db = getAdminDb()!
    clubId = `club${randomUUID().slice(0, 8)}`
    matchId = `${clubId}__m1`
    ids = Array.from({ length: 8 }, (_, i) => `${clubId}_p${i + 1}`)
    const batch = db.batch()
    batch.set(db.doc(`matches/${matchId}`), {
      clubId,
      date: Timestamp.fromDate(new Date('2099-01-01')),
      rsvpOpen: true,
    })
    ids.forEach((id, i) => {
      batch.set(db.doc(`users/${id}`), {
        uid: id,
        displayName: `Player ${i + 1}`,
        position: 'ST',
      })
      batch.set(db.doc(`clubMemberships/${clubId}_${id}`), {
        clubId,
        userId: id,
        role: 'player',
        status: 'active',
        joinedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      batch.set(db.doc(`rsvps/${matchId}_${id}`), {
        matchId,
        userId: id,
        status: 'confirmed',
        position: 'ST',
        rsvpAt: Timestamp.fromMillis(1000 + i),
      })
    })
    // RSVP order puts the four strongest (p1–p4) together on Team 1.
    batch.set(db.doc(`matches/${matchId}/teams/t1`), {
      matchId,
      teamNumber: 1,
      playerIds: ids.slice(0, 4),
      maxSize: 4,
    })
    batch.set(db.doc(`matches/${matchId}/teams/t2`), {
      matchId,
      teamNumber: 2,
      playerIds: ids.slice(4),
      maxSize: 4,
    })
    await batch.commit()
  })

  afterEach(async () => {
    await db.recursiveDelete(db.doc(`matches/${matchId}`))
    const batch = db.batch()
    ids.forEach(id => {
      batch.delete(db.doc(`users/${id}`))
      batch.delete(db.doc(`clubMemberships/${clubId}_${id}`))
      batch.delete(db.doc(`rsvps/${matchId}_${id}`))
    })
    batch.delete(db.doc(`clubSkillRankings/${clubId}`))
    await batch.commit()
  })

  it('saves ratings, rejects a stale save, and rebalances by them', async () => {
    // Fresh club: no ratings yet.
    const initial = await (await GET(new NextRequest(url()), context())).json()
    expect(initial.ranking).toEqual({ ratings: {}, version: 0 })
    expect(initial.members).toHaveLength(8)

    const ratings = Object.fromEntries(
      ids.map((id, i) => [id, [10, 9, 8, 7, 4, 3, 2, 1][i]])
    )
    const saved = await put({ ratings, version: 0 })
    expect(saved.status).toBe(200)
    expect((await saved.json()).ranking.version).toBe(1)

    const doc = (await db.doc(`clubSkillRankings/${clubId}`).get()).data()
    expect(doc).toMatchObject({
      clubId,
      ratings,
      version: 1,
      updatedBy: 'admin1',
    })

    // A second admin still holding version 0 can't overwrite it.
    const stale = await put({ ratings: { [ids[0]]: 1 }, version: 0 })
    expect(stale.status).toBe(409)
    expect(
      (await db.doc(`clubSkillRankings/${clubId}`).get()).data()?.ratings
    ).toEqual(ratings)

    // Out-of-range ratings are refused.
    expect((await put({ ratings: { [ids[0]]: 11 }, version: 1 })).status).toBe(
      400
    )

    const res = await rebalance(
      new NextRequest('http://localhost/api/teams/rebalance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)

    const [t1, t2] = await teams()
    const total = (team: string[]) =>
      team.reduce((sum, id) => sum + ratings[id], 0)
    expect(t1).toHaveLength(4)
    expect(t2).toHaveLength(4)
    expect([...t1, ...t2].sort()).toEqual([...ids].sort())
    // 44 points in all: an even 22–22 split.
    expect(total(t1)).toBe(22)
    expect(total(t2)).toBe(22)
    expect(body.strength).toMatchObject({
      unratedCount: 0,
      playerCount: 8,
      teams: [
        { teamNumber: 1, total: 22, size: 4 },
        { teamNumber: 2, total: 22, size: 4 },
      ],
    })
    // Skill moves are not saved as admin pins.
    expect(
      (await db.doc(`matches/${matchId}`).get()).data()?.manualTeamAssignments
    ).toBeUndefined()
  })

  it('counts unrated players as 5.5', async () => {
    await put({ ratings: { [ids[0]]: 10 }, version: 0 })
    const res = await rebalance(
      new NextRequest('http://localhost/api/teams/rebalance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
    )
    const body = await res.json()
    expect(body.strength.unratedCount).toBe(7)
    const totals = body.strength.teams.map((t: { total: number }) => t.total)
    expect(totals.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(
      10 + 7 * 5.5
    )
  })
})
