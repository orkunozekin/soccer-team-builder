// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import {
  CODE_OF_CONDUCT_REQUIRED_CODE,
  CODE_OF_CONDUCT_VERSION,
} from '@/lib/conduct/codeOfConduct'
import { CODE_OF_CONDUCT_AGREEMENTS_COLLECTION } from '@/lib/conduct/conductStoreAdmin'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'

const adminUids = new Set<string>()
vi.mock('@/lib/api/auth', () => ({
  verifyAuth: async (req: NextRequest) => ({
    uid: req.headers.get('authorization'),
    error: null,
  }),
  verifyClubAdminForMatch: async (req: NextRequest) => ({
    isClubAdmin: adminUids.has(req.headers.get('authorization') ?? ''),
  }),
}))
vi.mock('@/lib/services/auditService', () => ({ auditLog: vi.fn() }))

// Opt in only to the loopback emulator, never a configured remote database.
const emulator =
  process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-rsvp-cascade'

describe.skipIf(!emulator)('RSVP code of conduct gate on emulator', () => {
  let db: Firestore
  let prefix: string
  let clubId: string
  let matchIds: string[]
  let player: string
  let admin: string

  const rsvp = (uid: string, body: Record<string, unknown>) =>
    POST(
      new NextRequest('http://localhost/api/rsvp', {
        method: 'POST',
        headers: { authorization: uid, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    )
  const agreement = async (uid: string) =>
    (
      await db.doc(`${CODE_OF_CONDUCT_AGREEMENTS_COLLECTION}/${uid}`).get()
    ).data()
  const confirmedRsvps = async (matchId: string, uid: string) =>
    (
      await db
        .collection('rsvps')
        .where('matchId', '==', matchId)
        .where('userId', '==', uid)
        .where('status', '==', 'confirmed')
        .get()
    ).size
  const setRequired = (required: boolean) =>
    db.doc(`clubs/${clubId}`).set({
      name: prefix,
      slug: prefix,
      settings: { allowPlayerInvites: false, requireCodeOfConduct: required },
    })

  beforeEach(async () => {
    vi.mocked(auditLog).mockClear()
    adminUids.clear()
    db = getAdminDb()!
    prefix = `conduct_${randomUUID()}`
    clubId = `${prefix}_club`
    player = `${prefix}_player`
    admin = `${prefix}_admin`
    matchIds = [`${prefix}_m1`, `${prefix}_m2`]
    await setRequired(true)
    const batch = db.batch()
    for (const matchId of matchIds) {
      batch.set(db.doc(`matches/${matchId}`), {
        clubId,
        date: Timestamp.fromDate(new Date('2099-01-01')),
        rsvpOpen: true,
      })
    }
    for (const uid of [player, admin]) {
      batch.set(db.doc(`users/${uid}`), {
        uid,
        displayName: uid,
        position: 'ST',
      })
    }
    await batch.commit()
  })

  afterEach(async () => {
    for (const matchId of matchIds) {
      await db.recursiveDelete(db.doc(`matches/${matchId}`))
      const rsvps = await db
        .collection('rsvps')
        .where('matchId', '==', matchId)
        .get()
      await Promise.all(rsvps.docs.map(d => d.ref.delete()))
    }
    await Promise.all(
      [player, admin].flatMap(uid => [
        db.doc(`users/${uid}`).delete(),
        db.doc(`${CODE_OF_CONDUCT_AGREEMENTS_COLLECTION}/${uid}`).delete(),
      ])
    )
    await db.doc(`clubs/${clubId}`).delete()
  })

  it('blocks the first RSVP until the member agrees, then only once', async () => {
    const blocked = await rsvp(player, { matchId: matchIds[0] })
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).code).toBe(CODE_OF_CONDUCT_REQUIRED_CODE)
    expect(await confirmedRsvps(matchIds[0], player)).toBe(0)
    expect(await agreement(player)).toBeUndefined()

    const agreed = await rsvp(player, {
      matchId: matchIds[0],
      acceptCodeOfConductVersion: CODE_OF_CONDUCT_VERSION,
    })
    expect(agreed.status).toBe(200)
    expect(await confirmedRsvps(matchIds[0], player)).toBe(1)
    expect(await agreement(player)).toMatchObject({
      userId: player,
      version: CODE_OF_CONDUCT_VERSION,
      clubId,
      matchId: matchIds[0],
    })
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.code_of_conduct_agreed',
        entityId: player,
      })
    )

    // Next match: no agreement needed again.
    const next = await rsvp(player, { matchId: matchIds[1] })
    expect(next.status).toBe(200)
    expect(await confirmedRsvps(matchIds[1], player)).toBe(1)
  })

  it('rejects an agreement to a version other than the current one', async () => {
    const res = await rsvp(player, {
      matchId: matchIds[0],
      acceptCodeOfConductVersion: '2000-01-01',
    })
    expect(res.status).toBe(403)
    expect(await agreement(player)).toBeUndefined()
    expect(await confirmedRsvps(matchIds[0], player)).toBe(0)
  })

  it('does not ask when the club has not opted in', async () => {
    await setRequired(false)
    const res = await rsvp(player, { matchId: matchIds[0] })
    expect(res.status).toBe(200)
    expect(await agreement(player)).toBeUndefined()
  })

  it('lets a club admin RSVP someone else without their agreement', async () => {
    adminUids.add(admin)
    const res = await rsvp(admin, {
      matchId: matchIds[0],
      impersonateUserId: player,
    })
    expect(res.status).toBe(200)
    expect(await confirmedRsvps(matchIds[0], player)).toBe(1)
    expect(await agreement(player)).toBeUndefined()
  })

  it('still asks a club admin RSVPing for themselves', async () => {
    adminUids.add(admin)
    const res = await rsvp(admin, { matchId: matchIds[0] })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe(CODE_OF_CONDUCT_REQUIRED_CODE)
  })
})
