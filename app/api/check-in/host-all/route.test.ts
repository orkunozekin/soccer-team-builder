import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth', () => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
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
      ref: {
        id: doc.id,
        path: doc.id,
      },
      exists: true,
      data: () => doc.data,
    })),
  }
}

function makeDocSnap(doc: StoredDoc | null) {
  return {
    exists: doc != null,
    data: () => doc?.data,
  }
}

function createHostAllMockDb(initial: {
  match: StoredDoc
  rsvps: StoredDoc[]
}) {
  const rsvps = [...initial.rsvps]
  const batchUpdates: Array<{ id: string; data: Record<string, unknown> }> = []

  const adminDb = {
    collection: (path: string) => {
      if (path === 'matches') {
        return {
          doc: () => ({
            get: async () => makeDocSnap(initial.match),
          }),
        }
      }

      if (path === 'rsvps') {
        return {
          where: (_field: string, _op: string, matchId: string) => ({
            where: (_field2: string, _op2: string, status: string) => ({
              get: async () =>
                makeQuerySnap(
                  rsvps.filter(
                    r =>
                      r.data.matchId === matchId && r.data.status === status
                  )
                ),
            }),
          }),
        }
      }

      throw new Error(`Unexpected collection path: ${path}`)
    },
    batch: () => {
      const pending: Array<{ id: string; data: Record<string, unknown> }> = []
      return {
        update: (ref: { id: string }, data: Record<string, unknown>) => {
          pending.push({ id: ref.id, data })
        },
        commit: async () => {
          for (const update of pending) {
            batchUpdates.push(update)
            const idx = rsvps.findIndex(r => r.id === update.id)
            if (idx >= 0) {
              rsvps[idx] = {
                ...rsvps[idx],
                data: { ...rsvps[idx].data, ...update.data },
              }
            }
          }
        },
      }
    },
  }

  return { adminDb, rsvps, batchUpdates }
}

describe('POST /api/check-in/host-all', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin-1',
      isAdmin: true,
      error: null,
    })
  })

  it('marks all unmarked confirmed RSVPs present', async () => {
    const { adminDb, rsvps, batchUpdates } = createHostAllMockDb({
      match: {
        id: 'match-1',
        data: { deletedAt: null },
      },
      rsvps: [
        {
          id: 'rsvp-1',
          data: {
            matchId: 'match-1',
            userId: 'user-1',
            status: 'confirmed',
            attended: null,
          },
        },
        {
          id: 'rsvp-2',
          data: {
            matchId: 'match-1',
            userId: 'user-2',
            status: 'confirmed',
            attended: true,
          },
        },
        {
          id: 'rsvp-3',
          data: {
            matchId: 'match-1',
            userId: 'user-3',
            status: 'confirmed',
            attended: null,
          },
        },
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const request = new NextRequest('http://localhost/api/check-in/host-all', {
      method: 'POST',
      body: JSON.stringify({ matchId: 'match-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.updated).toHaveLength(2)
    expect(body.updated).toEqual(
      expect.arrayContaining([
        { rsvpId: 'rsvp-1', userId: 'user-1' },
        { rsvpId: 'rsvp-3', userId: 'user-3' },
      ])
    )
    expect(batchUpdates).toHaveLength(2)
    expect(rsvps.find(r => r.id === 'rsvp-1')?.data.attended).toBe(true)
    expect(rsvps.find(r => r.id === 'rsvp-3')?.data.attended).toBe(true)
  })

  it('returns success when everyone is already present', async () => {
    const { adminDb } = createHostAllMockDb({
      match: {
        id: 'match-1',
        data: { deletedAt: null },
      },
      rsvps: [
        {
          id: 'rsvp-1',
          data: {
            matchId: 'match-1',
            userId: 'user-1',
            status: 'confirmed',
            attended: true,
          },
        },
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const request = new NextRequest('http://localhost/api/check-in/host-all', {
      method: 'POST',
      body: JSON.stringify({ matchId: 'match-1' }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.updated).toEqual([])
    expect(body.message).toMatch(/already marked present/i)
  })
})
