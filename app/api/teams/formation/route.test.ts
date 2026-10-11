import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { verifyClubAdminForMatch } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdminForMatch: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
}))

vi.mock('@/lib/users/getUsersByIdsAdmin', () => ({
  getUsersByIdsAdmin: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: () => ({
      toDate: () => new Date('2024-06-01T12:00:00.000Z'),
    }),
  },
  FieldValue: {
    delete: () => ({ __delete: true }),
  },
}))

type StoredDoc = {
  id: string
  data: Record<string, unknown>
}

function makeQuerySnap(docs: StoredDoc[]) {
  return {
    size: docs.length,
    empty: docs.length === 0,
    docs: docs.map(doc => ({
      id: doc.id,
      ref: { id: doc.id, path: doc.id },
      exists: true,
      data: () => doc.data,
    })),
  }
}

function createFormationMockDb(initial: {
  teams: StoredDoc[]
  rsvps: StoredDoc[]
  users: StoredDoc[]
}) {
  const teams = [...initial.teams]
  const rsvps = initial.rsvps.map(r => ({ ...r, data: { ...r.data } }))
  const matchUpdates: Record<string, unknown>[] = []
  let stateData: Record<string, unknown> = { gkCount: 1 }

  const adminDb = {
    collection: (path: string) => {
      if (path.startsWith('matches/') && path.endsWith('/teams')) {
        return {
          get: async () => makeQuerySnap(teams),
        }
      }
      if (path === 'rsvps') {
        return {
          where: () => ({
            where: () => ({
              get: async () => makeQuerySnap(rsvps),
            }),
          }),
          doc: (id: string) => ({
            id,
            path: `rsvps/${id}`,
            update: async (data: Record<string, unknown>) => {
              const idx = rsvps.findIndex(r => r.id === id)
              if (idx >= 0) {
                rsvps[idx] = {
                  ...rsvps[idx]!,
                  data: { ...rsvps[idx]!.data, ...data },
                }
              }
            },
          }),
        }
      }
      if (path === 'matches') {
        return {
          doc: (matchId: string) => ({
            path: `matches/${matchId}`,
            collection: (sub: string) => {
              if (sub === '_state') {
                return {
                  doc: () => ({
                    path: `matches/${matchId}/_state/rsvp`,
                  }),
                }
              }
              return { doc: () => ({}) }
            },
            set: async (data: Record<string, unknown>) => {
              matchUpdates.push(data)
            },
          }),
        }
      }
      return {
        doc: () => ({}),
      }
    },
    runTransaction: async (
      fn: (tx: {
        get: (ref: { id?: string; path?: string }) => Promise<{
          exists: boolean
          ref: { id?: string; path?: string }
          data: () => Record<string, unknown>
        }>
        update: (
          ref: { id?: string; path?: string },
          data: Record<string, unknown>
        ) => void
        set: (
          ref: unknown,
          data: Record<string, unknown>,
          opts?: unknown
        ) => void
      }) => Promise<unknown>
    ) => {
      const pendingUpdates: Array<{
        id: string
        data: Record<string, unknown>
      }> = []
      const tx = {
        get: async (ref: { id?: string; path?: string }) => {
          if (ref.path?.includes('/_state/')) {
            return {
              exists: true,
              ref,
              data: () => stateData,
            }
          }
          if (ref.path?.startsWith('rsvps/') || ref.id) {
            const id = ref.id ?? ref.path!.split('/')[1]!
            const doc = rsvps.find(r => r.id === id)
            return {
              exists: doc != null,
              ref: { id, path: `rsvps/${id}` },
              data: () => doc?.data ?? {},
            }
          }
          return { exists: false, ref, data: () => ({}) }
        },
        update: (
          ref: { id?: string; path?: string },
          data: Record<string, unknown>
        ) => {
          const id = ref.id ?? ref.path?.split('/')[1]
          if (id) pendingUpdates.push({ id, data })
        },
        set: (
          _ref: unknown,
          data: Record<string, unknown>,
          _opts?: unknown
        ) => {
          if ('gkCount' in data) {
            stateData = { ...stateData, ...data }
          } else {
            matchUpdates.push(data)
          }
        },
      }
      const result = await fn(tx)
      for (const u of pendingUpdates) {
        const idx = rsvps.findIndex(r => r.id === u.id)
        if (idx >= 0) {
          rsvps[idx] = {
            ...rsvps[idx]!,
            data: { ...rsvps[idx]!.data, ...u.data },
          }
        }
      }
      return result
    },
  }

  return {
    adminDb,
    getRsvps: () => rsvps,
    getMatchUpdates: () => matchUpdates,
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/teams/formation', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/teams/formation', () => {
  beforeEach(() => {
    vi.mocked(verifyClubAdminForMatch).mockReset()
    vi.mocked(getAdminDb).mockReset()
    vi.mocked(getUsersByIdsAdmin).mockReset()
  })

  it('rejects unauthenticated callers', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: null,
      error: 'nope',
      isClubAdmin: false,
      matchExists: true,
    } as never)

    const res = await POST(makeRequest({ matchId: 'm1', formationId: '4-4-2' }))
    expect(res.status).toBe(401)
  })

  it('rejects non-admins', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: 'u1',
      error: null,
      isClubAdmin: false,
      matchExists: true,
    } as never)

    const res = await POST(makeRequest({ matchId: 'm1', formationId: '4-4-2' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid formation ids', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: 'u1',
      error: null,
      isClubAdmin: true,
      matchExists: true,
    } as never)

    const res = await POST(
      makeRequest({ matchId: 'm1', formationId: '9-9-9' })
    )
    expect(res.status).toBe(400)
  })

  it('skips cancelled RSVPs when committing formation writes', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: 'admin1',
      error: null,
      isClubAdmin: true,
      matchExists: true,
    } as never)

    const { adminDb, getRsvps } = createFormationMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['gk', 'lw'] },
        },
      ],
      rsvps: [
        {
          id: 'r_gk',
          data: {
            userId: 'gk',
            position: 'GK',
            status: 'confirmed',
            matchId: 'm1',
          },
        },
        {
          id: 'r_lw',
          data: {
            userId: 'lw',
            position: 'LW',
            status: 'confirmed',
            matchId: 'm1',
          },
        },
      ],
      users: [],
    })

    // Cancel after the pre-tx query would have seen confirmed — simulate by
    // flipping status before the transaction re-read path runs. The mock
    // re-reads live rsvp docs inside the transaction.
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
    vi.mocked(getUsersByIdsAdmin).mockResolvedValueOnce([
      { uid: 'gk', position: 'GK' },
      { uid: 'lw', position: 'LW' },
    ] as never)

    // Intercept: after first RSVP query, cancel lw before tx.
    const originalCollection = adminDb.collection
    let rsvpQueryCount = 0
    adminDb.collection = ((path: string) => {
      const col = originalCollection(path)
      if (path === 'rsvps') {
        return {
          ...col,
          where: () => {
            const chain = col.where()
            return {
              where: () => {
                const inner = chain.where()
                return {
                  get: async () => {
                    rsvpQueryCount += 1
                    const snap = await inner.get()
                    if (rsvpQueryCount === 1) {
                      const lw = getRsvps().find(r => r.id === 'r_lw')
                      if (lw) lw.data.status = 'cancelled'
                    }
                    return snap
                  },
                }
              },
            }
          },
          doc: col.doc,
        }
      }
      return col
    }) as typeof adminDb.collection

    const res = await POST(makeRequest({ matchId: 'm1', formationId: '4-4-2' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    const lw = getRsvps().find(r => r.id === 'r_lw')
    expect(lw?.data.position).toBe('LW')
    expect(json.assignments.every((a: { userId: string }) => a.userId !== 'lw')).toBe(
      true
    )
  })

  it('persists formation onto legacy RSVPs with null position', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: 'admin1',
      error: null,
      isClubAdmin: true,
      matchExists: true,
    } as never)

    const { adminDb, getRsvps } = createFormationMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1'] },
        },
      ],
      rsvps: [
        {
          id: 'r1',
          data: {
            userId: 'p1',
            position: null,
            status: 'confirmed',
            matchId: 'm1',
          },
        },
      ],
      users: [],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
    vi.mocked(getUsersByIdsAdmin).mockResolvedValueOnce([
      { uid: 'p1', position: 'CM' },
    ] as never)

    const res = await POST(makeRequest({ matchId: 'm1', formationId: '4-4-2' }))
    expect(res.status).toBe(200)
    expect(getRsvps()[0]?.data.position).toBeTruthy()
  })

  it('applies formation positions for club admins', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValueOnce({
      uid: 'admin1',
      error: null,
      isClubAdmin: true,
      matchExists: true,
    } as never)

    const { adminDb, getRsvps, getMatchUpdates } = createFormationMockDb({
      teams: [
        {
          id: 't1',
          data: {
            teamNumber: 1,
            playerIds: ['gk', 'lw', 'st', 'rw'],
          },
        },
      ],
      rsvps: [
        { id: 'r_gk', data: { userId: 'gk', position: 'GK', status: 'confirmed', matchId: 'm1' } },
        { id: 'r_lw', data: { userId: 'lw', position: 'LW', status: 'confirmed', matchId: 'm1' } },
        { id: 'r_st', data: { userId: 'st', position: 'ST', status: 'confirmed', matchId: 'm1' } },
        { id: 'r_rw', data: { userId: 'rw', position: 'RW', status: 'confirmed', matchId: 'm1' } },
      ],
      users: [],
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
    vi.mocked(getUsersByIdsAdmin).mockResolvedValueOnce([
      { uid: 'gk', position: 'GK' },
      { uid: 'lw', position: 'LW' },
      { uid: 'st', position: 'ST' },
      { uid: 'rw', position: 'RW' },
    ] as never)

    const res = await POST(makeRequest({ matchId: 'm1', formationId: '4-4-2' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.formationId).toBe('4-4-2')

    const byUser = new Map(
      getRsvps().map(r => [r.data.userId as string, r.data.position as string])
    )
    expect(byUser.get('gk')).toBe('GK')
    expect(byUser.get('lw')).toBe('LM')
    expect(byUser.get('rw')).toBe('RM')
    expect(byUser.get('st')).toBe('ST')
    expect(
      getMatchUpdates().some(u => u.selectedFormation === '4-4-2')
    ).toBe(true)
  })
})
