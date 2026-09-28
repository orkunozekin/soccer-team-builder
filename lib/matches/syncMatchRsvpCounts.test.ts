import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: () => ({ seconds: 1, nanoseconds: 0 }),
  },
}))

import {
  ensureMatchRsvpStateSeeded,
  syncMatchRsvpCountsFromConfirmed,
} from './syncMatchRsvpCounts'

const STATE_REF = { kind: 'state' }
const MATCH_REF = {
  kind: 'match',
  collection: () => ({ doc: () => STATE_REF }),
}
const RSVP_QUERY = { kind: 'rsvpQuery' }

function createAdminDb(opts: {
  stateExists: boolean
  confirmedPositions: Array<string | null>
}) {
  const sets: Array<{ ref: unknown; data: Record<string, unknown> }> = []
  const tx = {
    get: vi.fn(async (ref: unknown) => {
      if (ref === STATE_REF) return { exists: opts.stateExists }
      if (ref === RSVP_QUERY) {
        return {
          size: opts.confirmedPositions.length,
          docs: opts.confirmedPositions.map(position => ({
            data: () => ({ position }),
          })),
        }
      }
      throw new Error('unexpected tx.get')
    }),
    set: vi.fn((ref: unknown, data: Record<string, unknown>) => {
      sets.push({ ref, data })
    }),
  }
  const adminDb = {
    collection: (path: string) => {
      if (path === 'matches') return { doc: () => MATCH_REF }
      if (path === 'rsvps') {
        return { where: () => ({ where: () => RSVP_QUERY }) }
      }
      throw new Error(`unexpected ${path}`)
    },
    runTransaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }
  return { adminDb, tx, sets }
}

describe('syncMatchRsvpCountsFromConfirmed', () => {
  it('recounts inside a transaction that also reads _state/rsvp', async () => {
    const { adminDb, tx, sets } = createAdminDb({
      stateExists: true,
      confirmedPositions: ['GK', 'ST'],
    })

    const result = await syncMatchRsvpCountsFromConfirmed(
      adminDb as never,
      'match1'
    )

    expect(result).toEqual({ confirmedCount: 2, gkCount: 1 })
    expect(adminDb.runTransaction).toHaveBeenCalledTimes(1)
    expect(tx.get).toHaveBeenCalledWith(STATE_REF)
    expect(tx.get).toHaveBeenCalledWith(RSVP_QUERY)
    expect(sets.find(s => s.ref === STATE_REF)?.data).toMatchObject({
      confirmedCount: 2,
      gkCount: 1,
    })
    expect(sets.find(s => s.ref === MATCH_REF)?.data).toMatchObject({
      rsvpConfirmedCount: 2,
    })
  })
})

describe('ensureMatchRsvpStateSeeded', () => {
  it('no-ops when state already exists', async () => {
    const { adminDb, tx, sets } = createAdminDb({
      stateExists: true,
      confirmedPositions: ['GK'],
    })

    await ensureMatchRsvpStateSeeded(adminDb as never, 'match1')

    expect(tx.get).not.toHaveBeenCalledWith(RSVP_QUERY)
    expect(sets).toHaveLength(0)
  })

  it('seeds state from confirmed RSVPs in the same transaction', async () => {
    const { adminDb, sets } = createAdminDb({
      stateExists: false,
      confirmedPositions: ['GK', 'GK', 'CM'],
    })

    await ensureMatchRsvpStateSeeded(adminDb as never, 'match1')

    expect(adminDb.runTransaction).toHaveBeenCalledTimes(1)
    expect(sets.find(s => s.ref === STATE_REF)?.data).toMatchObject({
      confirmedCount: 3,
      gkCount: 2,
    })
    expect(sets.find(s => s.ref === MATCH_REF)?.data).toMatchObject({
      rsvpConfirmedCount: 3,
    })
  })
})
