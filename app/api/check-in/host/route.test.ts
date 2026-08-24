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
        update: vi.fn(async (data: Record<string, unknown>) => {
          doc.data = { ...doc.data, ...data }
        }),
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

function createHostMockDb(initial: {
  match: StoredDoc
  rsvps: StoredDoc[]
}) {
  const rsvps = [...initial.rsvps]

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
            where: (_field2: string, _op2: string, userId: string) => ({
              where: (_field3: string, _op3: string, status: string) => ({
                limit: () => ({
                  get: async () =>
                    makeQuerySnap(
                      rsvps.filter(
                        r =>
                          r.data.matchId === matchId &&
                          r.data.userId === userId &&
                          r.data.status === status
                      )
                    ),
                }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected collection path: ${path}`)
    },
  }

  return { adminDb, rsvps }
}

describe('POST /api/check-in/host', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin-1',
      isAdmin: true,
      error: null,
    })
  })

  it('allows admin to mark present after RSVP close time', async () => {
    const pastMatchDate = new Date('2020-01-01T19:00:00.000Z')
    const { adminDb, rsvps } = createHostMockDb({
      match: {
        id: 'match-1',
        data: {
          date: { toDate: () => pastMatchDate },
          time: '19:00',
          deletedAt: null,
        },
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
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const request = new NextRequest('http://localhost/api/check-in/host', {
      method: 'POST',
      body: JSON.stringify({
        matchId: 'match-1',
        userId: 'user-1',
        attended: true,
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      rsvpId: 'rsvp-1',
      attended: true,
    })
    expect(rsvps[0].data.attended).toBe(true)
    expect(rsvps[0].data.checkInMethod).toBe('host')
  })

  it('requires admin privileges', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'user-1',
      isAdmin: false,
      error: null,
    })

    const request = new NextRequest('http://localhost/api/check-in/host', {
      method: 'POST',
      body: JSON.stringify({
        matchId: 'match-1',
        userId: 'user-1',
        attended: true,
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
