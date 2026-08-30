import type { Firestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expandTeamsForMatch } from './expandTeamsForMatch'

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

function createMockFirestore(initial: {
  rsvps?: StoredDoc[]
  teams?: StoredDoc[]
  users?: StoredDoc[]
  match?: StoredDoc | null
}) {
  const rsvps = [...(initial.rsvps ?? [])]
  let teams = [...(initial.teams ?? [])]
  const users = [...(initial.users ?? [])]
  let match = initial.match ?? null

  const teamUpdates: Array<{ id: string; data: Record<string, unknown> }> = []
  const teamSets: Array<{ id: string; data: Record<string, unknown> }> = []
  const deletedTeamIds: string[] = []

  const adminDb = {
    collection: (path: string) => {
      if (path === 'rsvps') {
        return {
          where: () => ({
            where: () => ({
              get: async () => makeQuerySnap(rsvps),
            }),
          }),
        }
      }

      if (path === 'users') {
        return {
          get: async () => makeQuerySnap(users),
        }
      }

      if (path.startsWith('matches/') && path.endsWith('/teams')) {
        const matchId = path.split('/')[1]!
        return {
          get: async () => makeQuerySnap(teams),
          doc: (id: string) => ({
            update: async (data: Record<string, unknown>) => {
              teamUpdates.push({ id, data })
              teams = teams.map(team =>
                team.id === id
                  ? { ...team, data: { ...team.data, ...data } }
                  : team
              )
            },
            set: async (data: Record<string, unknown>) => {
              teamSets.push({ id, data })
              teams = [
                ...teams.filter(team => team.id !== id),
                { id, data: { ...data, matchId } },
              ]
            },
          }),
        }
      }

      if (path === 'matches') {
        return {
          doc: (matchId: string) => ({
            get: async () => makeDocSnap(match),
            set: async (data: Record<string, unknown>, _opts?: unknown) => {
              match = {
                id: matchId,
                data: { ...(match?.data ?? {}), ...data },
              }
            },
          }),
        }
      }

      throw new Error(`Unexpected collection path: ${path}`)
    },
    batch: () => {
      const pendingDeletes: string[] = []
      return {
        delete: (ref: { id: string }) => {
          pendingDeletes.push(ref.id)
        },
        commit: async () => {
          deletedTeamIds.push(...pendingDeletes)
          teams = teams.filter(team => !pendingDeletes.includes(team.id))
        },
      }
    },
  }

  return {
    adminDb: adminDb as unknown as Firestore,
    getTeams: () => teams,
    getTeamUpdates: () => teamUpdates,
    getTeamSets: () => teamSets,
    getDeletedTeamIds: () => deletedTeamIds,
    getMatch: () => match,
  }
}

function makeUserDoc(id: string, position: string | null = 'ST'): StoredDoc {
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

function makeRsvpDoc(
  id: string,
  userId: string,
  rsvpAt: Date,
  matchId = 'match1',
  position = 'ST'
): StoredDoc {
  return {
    id,
    data: {
      matchId,
      userId,
      status: 'confirmed',
      position,
      rsvpAt,
      updatedAt: rsvpAt,
    },
  }
}

function makeTeamDoc(
  id: string,
  teamNumber: number,
  playerIds: string[],
  matchId = 'match1'
): StoredDoc {
  return {
    id,
    data: {
      matchId,
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

describe('expandTeamsForMatch', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })

  it('returns regenerated false when there are no confirmed RSVPs', async () => {
    const { adminDb } = createMockFirestore({ rsvps: [], teams: [] })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: false })
  })

  it('creates teams from scratch when none exist yet', async () => {
    const { adminDb, getTeams } = createMockFirestore({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
      ],
      users: [makeUserDoc('p1'), makeUserDoc('p2')],
      teams: [],
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    expect(getTeams()).toHaveLength(2)
    expect(getTeams().flatMap(t => (t.data.playerIds as string[]) ?? [])).toEqual(
      expect.arrayContaining(['p1', 'p2'])
    )
  })

  it('does nothing when all RSVPs are already assigned and team count is sufficient', async () => {
    const { adminDb, getTeamUpdates, getTeamSets } = createMockFirestore({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
      ],
      users: [makeUserDoc('p1'), makeUserDoc('p2')],
      teams: [
        makeTeamDoc('team1', 1, ['p1']),
        makeTeamDoc('team2', 2, ['p2']),
      ],
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: false })
    expect(getTeamUpdates()).toHaveLength(0)
    expect(getTeamSets()).toHaveLength(0)
  })

  it('incrementally assigns only unassigned RSVPs without reshuffling existing rosters', async () => {
    const { adminDb, getTeams, getTeamUpdates } = createMockFirestore({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
        makeRsvpDoc('r3', 'p3', new Date('2024-01-01T12:00:00Z')),
      ],
      users: [makeUserDoc('p1'), makeUserDoc('p2'), makeUserDoc('p3')],
      teams: [
        makeTeamDoc('team1', 1, ['p2', 'p1']),
        makeTeamDoc('team2', 2, []),
      ],
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    expect(getTeamUpdates()).toHaveLength(1)
    expect(getTeams().find(t => t.id === 'team1')?.data.playerIds).toEqual([
      'p2',
      'p1',
      'p3',
    ])
    expect(getTeams().find(t => t.id === 'team2')?.data.playerIds).toEqual([])
  })

  it('promotes a late GK onto team 1 when teams 1 and 2 are full without a GK', async () => {
    const team1Ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 12}`)
    const allIds = [...team1Ids, ...team2Ids, 'gk_late']

    const { adminDb, getTeams, getMatch } = createMockFirestore({
      rsvps: allIds.map((id, index) =>
        makeRsvpDoc(
          `r${index + 1}`,
          id,
          new Date(2024, 0, 1, 0, index),
          'match1',
          id === 'gk_late' ? 'GK' : 'ST'
        )
      ),
      users: allIds.map(id =>
        makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')
      ),
      teams: [
        makeTeamDoc('team1', 1, team1Ids),
        makeTeamDoc('team2', 2, team2Ids),
      ],
      match: { id: 'match1', data: {} },
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)
    expect(team1?.data.playerIds).toContain('gk_late')
    expect(team1?.data.playerIds).not.toContain('p11')
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team2?.data.playerIds).toContain('p11')
    expect(team2?.data.playerIds).not.toContain('p22')
    expect(team3?.data.playerIds).toContain('p22')
    expect(getMatch()?.data.gkReplacements).toEqual({
      gk_late: 'p11',
    })
  })

  it('preserves manualTeamAssignments during incremental assignment', async () => {
    const { adminDb, getTeams } = createMockFirestore({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
        makeRsvpDoc(
          'r3',
          'gk_late',
          new Date('2024-01-01T12:00:00Z'),
          'match1',
          'GK'
        ),
      ],
      users: [
        makeUserDoc('p1'),
        makeUserDoc('p2'),
        makeUserDoc('gk_late', 'GK'),
      ],
      teams: [
        makeTeamDoc('team1', 1, ['p1']),
        makeTeamDoc('team2', 2, ['p2']),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: { p1: 2 } },
      },
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team1?.data.playerIds).not.toContain('p1')
    expect(team2?.data.playerIds).toContain('p1')
  })

  it('preserves manualTeamAssignments when GK shifting would bump a pinned player', async () => {
    const team1Ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 12}`)
    const allIds = [...team1Ids, ...team2Ids, 'gk_late']

    const { adminDb, getTeams } = createMockFirestore({
      rsvps: allIds.map((id, index) =>
        makeRsvpDoc(
          `r${index + 1}`,
          id,
          new Date(2024, 0, 1, 0, index),
          'match1',
          id === 'gk_late' ? 'GK' : 'ST'
        )
      ),
      users: allIds.map(id =>
        makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')
      ),
      teams: [
        makeTeamDoc('team1', 1, team1Ids),
        makeTeamDoc('team2', 2, team2Ids),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: { p22: 2 } },
      },
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)
    expect(team2?.data.playerIds).toContain('p22')
    expect(team3?.data.playerIds).not.toContain('p22')
  })

  it('preserves explicit transfers during force regeneration', async () => {
    const { adminDb, getTeams } = createMockFirestore({
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

    const result = await expandTeamsForMatch(adminDb, 'match1', {
      forceRegenerate: true,
    })

    expect(result).toEqual({ regenerated: true })

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team1?.data.playerIds).not.toContain('p1')
    expect(team2?.data.playerIds).toContain('p1')
  })
})
