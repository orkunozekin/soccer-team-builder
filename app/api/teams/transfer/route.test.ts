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
      ref: { id: doc.id, path: doc.id },
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

function createTransferMockDb(initial: {
  teams: StoredDoc[]
  match?: StoredDoc | null
}) {
  let teams = [...initial.teams]
  let matchData: Record<string, unknown> = {
    ...(initial.match?.data ?? {}),
  }
  const teamUpdates: Array<{ id: string; data: Record<string, unknown> }> = []
  const matchSets: Array<Record<string, unknown>> = []

  const adminDb = {
    collection: (path: string) => {
      if (path.startsWith('matches/') && path.endsWith('/teams')) {
        return {
          get: async () => makeQuerySnap(teams),
          doc: (id: string) => ({
            id,
            update: async (data: Record<string, unknown>) => {
              teamUpdates.push({ id, data })
              teams = teams.map(team =>
                team.id === id
                  ? { ...team, data: { ...team.data, ...data } }
                  : team
              )
            },
          }),
        }
      }

      if (path === 'matches') {
        return {
          doc: (matchId: string) => ({
            get: async () =>
              makeDocSnap(
                initial.match
                  ? { id: matchId, data: matchData }
                  : { id: matchId, data: matchData }
              ),
            set: async (
              data: Record<string, unknown>,
              _opts?: { merge?: boolean }
            ) => {
              matchSets.push(data)
              matchData = { ...matchData, ...data }
              if (
                data.manualTeamAssignments &&
                typeof data.manualTeamAssignments === 'object'
              ) {
                matchData.manualTeamAssignments = {
                  ...((matchData.manualTeamAssignments as Record<
                    string,
                    number
                  >) ?? {}),
                  ...(data.manualTeamAssignments as Record<string, number>),
                }
              }
            },
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
            teamUpdates.push(update)
            teams = teams.map(team =>
              team.id === update.id
                ? { ...team, data: { ...team.data, ...update.data } }
                : team
            )
          }
        },
      }
    },
  }

  return {
    adminDb,
    getTeams: () => teams,
    getTeamUpdates: () => teamUpdates,
    getMatchData: () => matchData,
    getMatchSets: () => matchSets,
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/teams/transfer', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/teams/transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin1',
      isAdmin: true,
      error: null,
    } as never)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: null,
      isAdmin: false,
      error: 'Unauthorized',
    } as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        targetTeamId: 't2',
      })
    )
    expect(res.status).toBe(401)
  })

  it('moves a player one-way and updates manual assignments', async () => {
    const { adminDb, getTeams, getMatchData } = createTransferMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1', 'p2'], maxSize: 11 },
        },
        {
          id: 't2',
          data: { teamNumber: 2, playerIds: ['p3'], maxSize: 11 },
        },
      ],
      match: { id: 'm1', data: { manualTeamAssignments: {} } },
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        targetTeamId: 't2',
        currentTeamId: 't1',
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.swapped).toBeUndefined()

    const teams = getTeams()
    expect(teams.find(t => t.id === 't1')?.data.playerIds).toEqual(['p2'])
    expect(teams.find(t => t.id === 't2')?.data.playerIds).toEqual(['p3', 'p1'])
    expect(getMatchData().manualTeamAssignments).toEqual({ p1: 2 })
  })

  it('removes the player from every team on one-way move', async () => {
    const { adminDb, getTeams } = createTransferMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1'], maxSize: 11 },
        },
        {
          id: 't2',
          data: { teamNumber: 2, playerIds: ['p1', 'p3'], maxSize: 11 },
        },
        {
          id: 't3',
          data: { teamNumber: 3, playerIds: [], maxSize: 11 },
        },
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        targetTeamId: 't3',
      })
    )
    expect(res.status).toBe(200)

    const teams = getTeams()
    expect(teams.find(t => t.id === 't1')?.data.playerIds).toEqual([])
    expect(teams.find(t => t.id === 't2')?.data.playerIds).toEqual(['p3'])
    expect(teams.find(t => t.id === 't3')?.data.playerIds).toEqual(['p1'])
  })

  it('swaps two players and both manual assignments', async () => {
    const { adminDb, getTeams, getMatchData } = createTransferMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1', 'p2'], maxSize: 11 },
        },
        {
          id: 't2',
          data: { teamNumber: 2, playerIds: ['p3', 'p4'], maxSize: 11 },
        },
      ],
      match: { id: 'm1', data: { manualTeamAssignments: { p9: 1 } } },
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        currentTeamId: 't1',
        targetTeamId: 't2',
        swapWithPlayerId: 'p3',
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, swapped: true })

    const teams = getTeams()
    expect(teams.find(t => t.id === 't1')?.data.playerIds).toEqual(['p2', 'p3'])
    expect(teams.find(t => t.id === 't2')?.data.playerIds).toEqual(['p4', 'p1'])
    expect(getMatchData().manualTeamAssignments).toEqual({
      p9: 1,
      p1: 2,
      p3: 1,
    })
  })

  it('rejects swap on the same team', async () => {
    const { adminDb } = createTransferMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1', 'p2'], maxSize: 11 },
        },
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        targetTeamId: 't1',
        swapWithPlayerId: 'p2',
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/same team/i)
  })

  it('rejects swap when swap player is missing from target team', async () => {
    const { adminDb } = createTransferMockDb({
      teams: [
        {
          id: 't1',
          data: { teamNumber: 1, playerIds: ['p1'], maxSize: 11 },
        },
        {
          id: 't2',
          data: { teamNumber: 2, playerIds: ['p3'], maxSize: 11 },
        },
      ],
    })
    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const res = await POST(
      makeRequest({
        matchId: 'm1',
        playerId: 'p1',
        targetTeamId: 't2',
        swapWithPlayerId: 'p_missing',
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/not found on target team/i)
  })
})
