import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: () => ({ seconds: 1, nanoseconds: 0 }),
  },
}))

import {
  ensureMatchRsvpStateSeeded,
  syncMatchRsvpCountsFromConfirmed,
} from './syncMatchRsvpCounts'

describe('syncMatchRsvpCountsFromConfirmed', () => {
  it('writes confirmed and gk counts from remaining RSVPs', async () => {
    const setCalls: Array<{ merge?: boolean; data: Record<string, unknown> }> =
      []
    const batch = {
      set: (
        _ref: unknown,
        data: Record<string, unknown>,
        opts?: { merge?: boolean }
      ) => {
        setCalls.push({ data, merge: opts?.merge })
      },
      commit: vi.fn(async () => undefined),
    }
    const adminDb = {
      collection: (path: string) => {
        if (path === 'rsvps') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  size: 2,
                  docs: [
                    { data: () => ({ position: 'GK' }) },
                    { data: () => ({ position: 'ST' }) },
                  ],
                }),
              }),
            }),
          }
        }
        if (path === 'matches') {
          return {
            doc: () => ({
              collection: () => ({
                doc: () => ({}),
              }),
            }),
          }
        }
        throw new Error(`unexpected ${path}`)
      },
      batch: () => batch,
    }

    const result = await syncMatchRsvpCountsFromConfirmed(
      adminDb as never,
      'match1'
    )
    expect(result).toEqual({ confirmedCount: 2, gkCount: 1 })
    expect(batch.commit).toHaveBeenCalledTimes(1)
    expect(setCalls).toHaveLength(2)
    expect(setCalls[0]?.data).toMatchObject({
      confirmedCount: 2,
      gkCount: 1,
    })
    expect(setCalls[1]?.data).toMatchObject({ rsvpConfirmedCount: 2 })
  })
})

describe('ensureMatchRsvpStateSeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no-ops when state already exists', async () => {
    const create = vi.fn()
    const adminDb = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            doc: () => ({
              get: async () => ({ exists: true }),
              create,
            }),
          }),
        }),
      }),
    }
    await ensureMatchRsvpStateSeeded(adminDb as never, 'match1')
    expect(create).not.toHaveBeenCalled()
  })

  it('seeds state from existing confirmed RSVPs', async () => {
    const create = vi.fn(async () => undefined)
    const matchSet = vi.fn(async () => undefined)
    const adminDb = {
      collection: (path: string) => {
        if (path === 'matches') {
          return {
            doc: () => ({
              collection: () => ({
                doc: () => ({
                  get: async () => ({ exists: false }),
                  create,
                }),
              }),
              set: matchSet,
            }),
          }
        }
        if (path === 'rsvps') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  size: 3,
                  docs: [
                    { data: () => ({ position: 'GK' }) },
                    { data: () => ({ position: 'GK' }) },
                    { data: () => ({ position: 'CM' }) },
                  ],
                }),
              }),
            }),
          }
        }
        throw new Error(`unexpected ${path}`)
      },
    }

    await ensureMatchRsvpStateSeeded(adminDb as never, 'match1')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ confirmedCount: 3, gkCount: 2 })
    )
    expect(matchSet).toHaveBeenCalledWith(
      expect.objectContaining({ rsvpConfirmedCount: 3 }),
      { merge: true }
    )
  })

  it('ignores concurrent create races', async () => {
    const create = vi.fn(async () => {
      const err = new Error('ALREADY_EXISTS') as Error & { code: number }
      err.code = 6
      throw err
    })
    const adminDb = {
      collection: (path: string) => {
        if (path === 'matches') {
          return {
            doc: () => ({
              collection: () => ({
                doc: () => ({
                  get: async () => ({ exists: false }),
                  create,
                }),
              }),
              set: vi.fn(),
            }),
          }
        }
        if (path === 'rsvps') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({ size: 0, docs: [] }),
              }),
            }),
          }
        }
        throw new Error(`unexpected ${path}`)
      },
    }

    await expect(
      ensureMatchRsvpStateSeeded(adminDb as never, 'match1')
    ).resolves.toBeUndefined()
  })
})
