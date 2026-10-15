// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH, POST } from './route'
import { getAdminDb } from '@/lib/firebase/admin'
import { acquireMatchLock } from '@/lib/locks/matchLock'
import { auditLog } from '@/lib/services/auditService'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'

vi.mock('@/lib/api/auth', () => ({
  verifyAuth: async (req: NextRequest) => ({
    uid: req.headers.get('authorization'),
    error: null,
  }),
  verifyClubAdminForMatch: async () => ({ isClubAdmin: false }),
}))
vi.mock('@/lib/services/auditService', () => ({ auditLog: vi.fn() }))
vi.mock('@/lib/teams/removeUserFromMatchTeams', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/teams/removeUserFromMatchTeams')
    >()
  return {
    ...actual,
    removeUserFromMatchTeams: vi.fn(actual.removeUserFromMatchTeams),
  }
})

// Opt in only to the loopback emulator, never a configured remote database.
const emulator =
  process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-rsvp-cascade'
describe.skipIf(!emulator)(
  'RSVP cancellation and arrival on Firestore emulator',
  () => {
    let db: Firestore
    let matchId: string
    let ids: string[]
    const request = (method: string, uid: string, body: object) =>
      new NextRequest('http://localhost/api/rsvp', {
        method,
        headers: { authorization: uid, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    const cancel = (uid = ids[0], id = uid) =>
      PATCH(request('PATCH', uid, { rsvpId: `${matchId}_${id}` }))
    const arrive = (uid = ids[24]) => POST(request('POST', uid, { matchId }))
    const rosters = async () =>
      (await db.collection(`matches/${matchId}/teams`).get()).docs
        .sort((a, b) => a.data().teamNumber - b.data().teamNumber)
        .map(d => d.data().playerIds as string[])
    const count = async () =>
      (await db.doc(`matches/${matchId}/_state/rsvp`).get()).data()
        ?.confirmedCount

    beforeEach(async () => {
      vi.mocked(auditLog).mockClear()
      db = getAdminDb()!
      matchId = `test_${randomUUID()}`
      ids = Array.from(
        { length: 25 },
        (_, i) => `${matchId}_p${String(i + 1).padStart(2, '0')}`
      )
      const batch = db.batch()
      batch.set(db.doc(`matches/${matchId}`), {
        date: Timestamp.fromDate(new Date('2099-01-01')),
        rsvpOpen: true,
        rsvpConfirmedCount: 24,
      })
      batch.set(db.doc(`matches/${matchId}/_state/rsvp`), {
        confirmedCount: 24,
        gkCount: 0,
      })
      ids.forEach((id, i) => {
        batch.set(db.doc(`users/${id}`), {
          uid: id,
          displayName: `Player ${i + 1}`,
          position: 'ST',
        })
        if (i < 24)
          batch.set(db.doc(`rsvps/${matchId}_${id}`), {
            matchId,
            userId: id,
            status: 'confirmed',
            position: 'ST',
            rsvpAt: Timestamp.fromMillis(i + 1000),
          })
      })
      for (let n = 1; n <= 3; n++)
        batch.set(db.doc(`matches/${matchId}/teams/t${n}`), {
          matchId,
          teamNumber: n,
          playerIds: ids.slice((n - 1) * 11, Math.min(n * 11, 24)),
          maxSize: 11,
        })
      await batch.commit()
    })
    afterEach(async () => {
      vi.mocked(removeUserFromMatchTeams).mockClear()
      await db.recursiveDelete(db.doc(`matches/${matchId}`))
      const batch = db.batch()
      const rsvps = await db
        .collection('rsvps')
        .where('matchId', '==', matchId)
        .get()
      rsvps.docs.forEach(d => batch.delete(d.ref))
      ids.forEach(id => batch.delete(db.doc(`users/${id}`)))
      await batch.commit()
    })

    it.each([0, 11])(
      'cascades Team 1/2 cancellation followed by arrival (%s)',
      async index => {
        expect((await cancel(ids[index])).status).toBe(200)
        const afterCancel = await rosters()
        expect(afterCancel.map(t => t.length)).toEqual([11, 11, 1])
        expect(afterCancel[index === 0 ? 0 : 1]).toContain(
          ids[index === 0 ? 11 : 22]
        )
        expect((await arrive()).status).toBe(200)
        const final = await rosters()
        expect(final.map(t => t.length)).toEqual([11, 11, 2])
        expect(final[2]).toContain(ids[24])
        expect(new Set(final.flat()).size).toBe(24)
        expect(await count()).toBe(24)
        const retained = (
          await db.doc(`rsvps/${matchId}_${ids[index]}`).get()
        ).data()!
        expect(retained.status).toBe('cancelled')
        expect(retained.rsvpAt.toMillis()).toBe(index + 1000)
      }
    )

    it('preserves intentional manual assignments and goalkeeper limits during cancellation', async () => {
      await db
        .doc(`matches/${matchId}`)
        .update({ manualTeamAssignments: { [ids[11]]: 2 } })
      await db.doc(`rsvps/${matchId}_${ids[1]}`).update({ position: 'GK' })
      await db.doc(`rsvps/${matchId}_${ids[12]}`).update({ position: 'GK' })
      expect((await cancel()).status).toBe(200)
      const final = await rosters()
      expect(final[0]).toContain(ids[13])
      expect(final[1]).toContain(ids[11])
      expect(final[1]).toContain(ids[12])
      expect(final[0]).not.toContain(ids[12])
    })

    it('never resurrects a cancelled player through a retained manual pin on later arrival', async () => {
      await db
        .doc(`matches/${matchId}`)
        .update({ manualTeamAssignments: { [ids[0]]: 1 } })
      expect((await cancel()).status).toBe(200)
      expect((await arrive()).status).toBe(200)
      const final = await rosters()
      expect(final.flat().sort()).toEqual(ids.slice(1).sort())
      expect(final[2]).toContain(ids[24])
      expect(await count()).toBe(24)
    })

    it('removes all teams when the last player cancels and retains the cancelled record', async () => {
      const batch = db.batch()
      ids.slice(1, 24).forEach(id =>
        batch.update(db.doc(`rsvps/${matchId}_${id}`), {
          status: 'cancelled',
        })
      )
      batch.set(db.doc(`matches/${matchId}/_state/rsvp`), {
        confirmedCount: 1,
        gkCount: 0,
      })
      await batch.commit()
      expect((await cancel()).status).toBe(200)
      expect(await rosters()).toEqual([])
      expect(await count()).toBe(0)
      expect((await db.doc(`rsvps/${matchId}_${ids[0]}`).get()).exists).toBe(
        true
      )
    })

    it('handles last-team cancellation and empty middle teams with stable manual pin targets', async () => {
      await db.doc(`matches/${matchId}/teams/t2`).update({ playerIds: [] })
      await db
        .doc(`matches/${matchId}`)
        .update({ manualTeamAssignments: { [ids[22]]: 3 } })
      expect((await cancel(ids[23])).status).toBe(200)
      const final = await rosters()
      expect(final[0]).toEqual(ids.slice(0, 11))
      expect(final[1]).toEqual([ids[22]])
      expect(
        (await db.doc(`matches/${matchId}`).get()).data()?.manualTeamAssignments
      ).toEqual({ [ids[22]]: 2 })
    })

    it('leaves original rosters intact if the roster transaction fails before commit', async () => {
      await db.doc(`rsvps/${matchId}_${ids[0]}`).update({ status: 'cancelled' })
      const before = await rosters()
      const original = db.runTransaction.bind(db)
      const spy = vi
        .spyOn(db, 'runTransaction')
        .mockImplementationOnce(callback =>
          original(async tx => {
            const update = tx.update.bind(tx)
            let writes = 0
            tx.update = ((...args: Parameters<typeof tx.update>) => {
              if (++writes === 2)
                throw new Error('injected second roster write failure')
              return update(...args)
            }) as typeof tx.update
            return callback(tx)
          })
        )
      try {
        await expect(
          removeUserFromMatchTeams(db, matchId, ids[0])
        ).rejects.toThrow('injected second roster write failure')
      } finally {
        spy.mockRestore()
      }
      expect(await rosters()).toEqual(before)
      await removeUserFromMatchTeams(db, matchId, ids[0])
      expect((await rosters()).map(t => t.length)).toEqual([11, 11, 1])
    })

    it('serializes concurrent cancellation/arrival and duplicate cancellation without losing players or counts', async () => {
      const responses = await Promise.all([cancel(), arrive(), cancel()])
      expect(responses.map(r => r.status)).toEqual([200, 200, 200])
      const final = await rosters()
      expect(final.map(t => t.length)).toEqual([11, 11, 2])
      expect(final.flat().sort()).toEqual(ids.slice(1).sort())
      expect(final[2]).toContain(ids[24])
      expect(await count()).toBe(24)
    }, 15000)

    it('does not commit cancellation or arrival while the match lock is busy', async () => {
      const lock = await acquireMatchLock(db, matchId)
      try {
        expect((await cancel()).status).toBe(503)
        expect((await arrive()).status).toBe(503)
        expect(await count()).toBe(24)
        expect(
          (await db.doc(`rsvps/${matchId}_${ids[0]}`).get()).data()?.status
        ).toBe('confirmed')
      } finally {
        await lock!.release()
      }
      expect((await cancel()).status).toBe(200)
    }, 15000)

    it('retries cleanup after cancellation committed and cleanup failed without a second decrement', async () => {
      vi.mocked(removeUserFromMatchTeams).mockRejectedValueOnce(
        new Error('injected roster failure')
      )
      expect((await cancel()).status).toBe(500)
      expect(await count()).toBe(23)
      expect((await cancel()).status).toBe(200)
      expect(await count()).toBe(23)
      expect((await rosters()).flat()).not.toContain(ids[0])
      expect((await rosters()).map(t => t.length)).toEqual([11, 11, 1])
    })

    it('arrival repairs an interrupted cleanup before filling the direct earlier vacancy', async () => {
      vi.mocked(removeUserFromMatchTeams).mockRejectedValueOnce(
        new Error('injected roster failure')
      )
      expect((await cancel()).status).toBe(500)
      expect((await arrive()).status).toBe(200)
      const final = await rosters()
      expect(final.flat().sort()).toEqual(ids.slice(1).sort())
      expect(final[0]).toContain(ids[11])
      expect(final[1]).toContain(ids[22])
      expect(final[2]).toContain(ids[24])
    })

    it('retrying old cancellation preserves a newly confirmed rejoin by the same user', async () => {
      expect((await cancel()).status).toBe(200)
      const rejoin = await POST(request('POST', ids[0], { matchId }))
      expect(rejoin.status).toBe(200)
      const rejoinId = (await rejoin.json()).rsvpId
      const before = await rosters()
      expect((await cancel()).status).toBe(200)
      expect(await rosters()).toEqual(before)
      expect((await rosters()).flat()).toContain(ids[0])
      expect(await count()).toBe(24)
      expect((await db.doc(`rsvps/${rejoinId}`).get()).data()?.status).toBe(
        'confirmed'
      )
    })
  }
)
