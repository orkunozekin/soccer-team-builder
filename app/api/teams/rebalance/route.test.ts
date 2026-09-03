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

function createRebalanceMockRepos(initial: {
  teams: StoredDoc[]
  rsvps: StoredDoc[]
  users: StoredDoc[]
  match?: StoredDoc | null
}) {
  let teams = [...initial.teams]
  let matchData: Record<string, unknown> = {
    ...(initial.match?.data ?? {}),
  }
  const teamUpdates: Array<{ id: string; data: Record<string, unknown> }> = []

  const adminDb = {
    collection: (path: string) => {
      if (path === 'rsvps') {
        return {
          where: () => ({
            where: () => ({
              get: async () => makeQuerySnap(initial.rsvps),
            }),
          }),
        }
      }

      if (path === 'users') {
        return {
          get: async () => makeQuerySnap(initial.users),
        }
      }

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
            get: async () => makeDocSnap({ id: matchId, data: matchData }),
            set: async (
              data: Record<string, unknown>,
              opts?: { merge?: boolean }
            ) => {
              matchData = opts?.merge ? { ...matchData, ...data } : data
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
  }
}

function makeUserDoc(id: string, position = 'CM'): StoredDoc {
  return {
    id,
    data: {
      uid: id,
      email: `${id}@example.com`,
      displayName: id,
      jerseyNumber: null,
      position,
      role: 'user',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  }
}

function makeRsvpDoc(id: string, userId: string, rsvpAt: Date): StoredDoc {
  return {
    id,
    data: {
      matchId: 'match1',
      userId,
      status: 'confirmed',
      position: 'CM',
      rsvpAt,
      updatedAt: rsvpAt,
    },
  }
}

function makeTeamDoc(
  id: string,
  teamNumber: number,
  playerIds: string[]
): StoredDoc {
  return {
    id,
    data: {
      matchId: 'match1',
      teamNumber,
      name: `Team ${teamNumber}`,
      color: '#3b82f6',
      playerIds,
      maxSize: 11,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  }
}

function makeRequest(matchId = 'match1') {
  return new NextRequest('http://localhost/api/teams/rebalance', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  })
}

describe('POST /api/teams/rebalance', () => {
  beforeEach(() => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: 'admin1',
      isAdmin: true,
      error: null,
    })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(verifyAdmin).mockResolvedValue({
      uid: null,
      isAdmin: false,
      error: 'Unauthorized',
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it('evens out an 11 vs 3 imbalance without treating skew as manual transfers', async () => {
    const playerIds = Array.from({ length: 14 }, (_, i) => `p${i + 1}`)
    const rsvps = playerIds.map((id, i) =>
      makeRsvpDoc(
        `r${i + 1}`,
        id,
        new Date(`2024-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`)
      )
    )
    const users = playerIds.map(id => makeUserDoc(id))

    const { adminDb, getTeams, getMatchData } = createRebalanceMockRepos({
      rsvps,
      users,
      teams: [
        makeTeamDoc('team1', 1, playerIds.slice(0, 11)),
        makeTeamDoc('team2', 2, playerIds.slice(11)),
      ],
      match: {
        id: 'match1',
        // No persisted pins — skew came from fill order / non-persisted state
        data: { manualTeamAssignments: {} },
      },
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.assignedCounts).toEqual([7, 7])

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team1?.data.playerIds).toEqual(playerIds.slice(0, 7))
    expect(team2?.data.playerIds).toEqual(playerIds.slice(7, 14))
    expect(getMatchData().manualTeamAssignments).toEqual({})
  })

  it('preserves explicit transfers when rebalancing teams', async () => {
    const { adminDb, getTeams, getMatchData } = createRebalanceMockRepos({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
        makeRsvpDoc('r3', 'p3', new Date('2024-01-01T12:00:00Z')),
        makeRsvpDoc('r4', 'p4', new Date('2024-01-01T13:00:00Z')),
      ],
      users: [
        makeUserDoc('p1'),
        makeUserDoc('p2'),
        makeUserDoc('p3'),
        makeUserDoc('p4'),
      ],
      teams: [
        makeTeamDoc('team1', 1, ['p2', 'p3']),
        makeTeamDoc('team2', 2, ['p1', 'p4']),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: { p1: 2 } },
      },
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.assignedCounts).toEqual([2, 2])

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team1?.data.playerIds).not.toContain('p1')
    expect(team2?.data.playerIds).toContain('p1')
    // Persisted pins are kept for later regenerate/expand
    expect(getMatchData().manualTeamAssignments).toEqual({ p1: 2 })
  })

  it('preserves a two-player swap between teams during rebalance', async () => {
    const { adminDb, getTeams, getMatchData } = createRebalanceMockRepos({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
        makeRsvpDoc('r3', 'p3', new Date('2024-01-01T12:00:00Z')),
        makeRsvpDoc('r4', 'p4', new Date('2024-01-01T13:00:00Z')),
        makeRsvpDoc('r5', 'p5', new Date('2024-01-01T14:00:00Z')),
        makeRsvpDoc('r6', 'p6', new Date('2024-01-01T15:00:00Z')),
      ],
      users: [
        makeUserDoc('p1'),
        makeUserDoc('p2'),
        makeUserDoc('p3'),
        makeUserDoc('p4'),
        makeUserDoc('p5'),
        makeUserDoc('p6'),
      ],
      teams: [
        makeTeamDoc('team1', 1, ['p2', 'p3']),
        makeTeamDoc('team2', 2, ['p1', 'p4']),
        makeTeamDoc('team3', 3, ['p5', 'p6']),
      ],
      match: {
        id: 'match1',
        data: {
          manualTeamAssignments: { p1: 2, p5: 3 },
        },
      },
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)

    expect(team1?.data.playerIds).not.toContain('p1')
    expect(team2?.data.playerIds).toContain('p1')
    expect(team3?.data.playerIds).toContain('p5')
    expect(getMatchData().manualTeamAssignments).toEqual({ p1: 2, p5: 3 })
  })

  it('keeps one-way pins but still restores even sizes by moving unpinned players', async () => {
    const playerIds = Array.from({ length: 14 }, (_, i) => `p${i + 1}`)
    const rsvps = playerIds.map((id, i) =>
      makeRsvpDoc(
        `r${i + 1}`,
        id,
        new Date(`2024-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`)
      )
    )
    const users = playerIds.map(id => makeUserDoc(id))

    // Later RSVPs were dragged onto team 1 (persisted pins)
    const pinnedToTeam1 = playerIds.slice(10) // p11..p14
    const persistedManual: Record<string, number> = {}
    for (const id of pinnedToTeam1) {
      persistedManual[id] = 1
    }

    const { adminDb, getTeams, getMatchData } = createRebalanceMockRepos({
      rsvps,
      users,
      teams: [
        makeTeamDoc('team1', 1, playerIds.slice(0, 11)),
        makeTeamDoc('team2', 2, playerIds.slice(11)),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: persistedManual },
      },
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assignedCounts).toEqual([7, 7])

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team1Ids = (team1?.data.playerIds as string[]) ?? []
    for (const id of pinnedToTeam1) {
      expect(team1Ids).toContain(id)
    }
    expect(getMatchData().manualTeamAssignments).toEqual(persistedManual)
  })

  it('places later team pairs by contiguous RSVP order (not position scramble)', async () => {
    // 44 players → 4 teams of 11. RSVPs 23–24 must land on Team 3, not Team 4.
    const playerIds = Array.from({ length: 44 }, (_, i) => `p${i + 1}`)
    const positions = ['ST', 'CB', 'CM', 'CAM', 'LW', 'RB', 'CDM', 'LWB', 'RW', 'LB', 'GK']
    const rsvps = playerIds.map((id, i) =>
      makeRsvpDoc(
        `r${i + 1}`,
        id,
        new Date(Date.UTC(2024, 0, 1, 10, i))
      )
    )
    const users = playerIds.map((id, i) =>
      makeUserDoc(id, positions[i % positions.length]!)
    )

    const { adminDb, getTeams } = createRebalanceMockRepos({
      rsvps,
      users,
      teams: [
        makeTeamDoc('team1', 1, playerIds.slice(0, 11)),
        makeTeamDoc('team2', 2, playerIds.slice(11, 22)),
        makeTeamDoc('team3', 3, playerIds.slice(22, 33)),
        makeTeamDoc('team4', 4, playerIds.slice(33)),
      ],
      match: { id: 'match1', data: { manualTeamAssignments: {} } },
    })

    vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.assignedCounts).toEqual([11, 11, 11, 11])

    const byNumber = (n: number) =>
      (getTeams().find(t => (t.data.teamNumber as number) === n)?.data
        .playerIds as string[]) ?? []

    expect(byNumber(1)).toEqual(playerIds.slice(0, 11))
    expect(byNumber(2)).toEqual(playerIds.slice(11, 22))
    expect(byNumber(3)).toEqual(playerIds.slice(22, 33))
    expect(byNumber(4)).toEqual(playerIds.slice(33, 44))
    expect(byNumber(3)).toContain('p23')
    expect(byNumber(3)).toContain('p24')
    expect(byNumber(4)).not.toContain('p23')
    expect(byNumber(4)).not.toContain('p24')
  })
})
