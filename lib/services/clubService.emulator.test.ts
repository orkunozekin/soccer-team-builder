// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAdminDb } from '@/lib/firebase/admin'
import { updateClub } from '@/lib/services/clubService'

// Opt in only to the loopback emulator, never a configured remote database.
const emulator =
  process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-rsvp-cascade'

describe.skipIf(!emulator)('updateClub settings on emulator', () => {
  let clubId: string

  beforeEach(async () => {
    clubId = `club_${randomUUID()}`
    await getAdminDb()!
      .doc(`clubs/${clubId}`)
      .set({
        name: clubId,
        slug: clubId,
        settings: { allowPlayerInvites: false, requireCodeOfConduct: false },
      })
  })

  afterEach(async () => {
    await getAdminDb()!.doc(`clubs/${clubId}`).delete()
  })

  it('keeps both settings when two admins change different ones at once', async () => {
    await Promise.all([
      updateClub(clubId, { settings: { allowPlayerInvites: true } }),
      updateClub(clubId, { settings: { requireCodeOfConduct: true } }),
    ])
    const stored = (await getAdminDb()!.doc(`clubs/${clubId}`).get()).data()
    expect(stored?.settings).toEqual({
      allowPlayerInvites: true,
      requireCodeOfConduct: true,
    })
  })

  it('leaves settings that were not sent untouched', async () => {
    await updateClub(clubId, { settings: { requireCodeOfConduct: true } })
    const club = await updateClub(clubId, {
      settings: { allowPlayerInvites: true },
    })
    expect(club.settings).toEqual({
      allowPlayerInvites: true,
      requireCodeOfConduct: true,
    })
  })
})
