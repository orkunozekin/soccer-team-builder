import type { Firestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { placeGkOnTeamWithoutGk } from './placeGkOnTeamWithoutGk'

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
        update: async (data: Record<string, unknown>) => {
          Object.assign(doc.data, data)
        },
        set: async (data: Record<string, unknown>) => {
          doc.data = { ...data }
        },
      },
      exists: true,
      data: () => doc.data,
    })),
  }
}

function createPlaceGkMockDb(initial: {
  rsvps: StoredDoc[]
  teams: StoredDoc[]
  match?: StoredDoc | null
}) {
  let teams = initial.teams.map(t => ({
    id: t.id,
    data: { ...t.data, playerIds: [...(t.data.playerIds as string[])] },
  }))
  let match = initial.match
    ? { id: initial.match.id, data: { ...initial.match.data } }
    : null
  let autoId = 0

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

      if (path.startsWith('matches/') && path.endsWith('/teams')) {
        return {
          orderBy: () => ({
            get: async () => makeQuerySnap(teams),
          }),
          get: async () => makeQuerySnap(teams),
          doc: (id?: string) => {
            const docId = id ?? `auto_${++autoId}`
            const existing = teams.find(t => t.id === docId)
            const ref = {
              id: docId,
              update: async (data: Record<string, unknown>) => {
                teams = teams.map(team =>
                  team.id === docId
                    ? { ...team, data: { ...team.data, ...data } }
                    : team
                )
              },
              set: async (data: Record<string, unknown>) => {
                teams = [
                  ...teams.filter(t => t.id !== docId),
                  { id: docId, data: { ...data } },
                ]
              },
            }
            if (existing) {
              // Keep ref methods bound to live team state via update/set above.
            }
            return ref
          },
        }
      }

      if (path === 'matches') {
        return {
          doc: (matchId: string) => ({
            get: async () => ({
              exists: match != null,
              data: () => match?.data,
            }),
            set: async (data: Record<string, unknown>) => {
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
  }

  return {
    adminDb: adminDb as unknown as Firestore,
    getTeams: () => teams,
    getMatch: () => match,
  }
}

function makeRsvp(
  userId: string,
  index: number,
  position = 'ST'
): StoredDoc {
  return {
    id: `r_${userId}`,
    data: {
      matchId: 'match1',
      userId,
      status: 'confirmed',
      position,
      rsvpAt: {
        toDate: () => new Date(2024, 0, 1, 0, index),
      },
    },
  }
}

function makeTeam(
  id: string,
  teamNumber: number,
  playerIds: string[]
): StoredDoc {
  return {
    id,
    data: {
      matchId: 'match1',
      teamNumber,
      playerIds,
      maxSize: 11,
    },
  }
}

describe('placeGkOnTeamWithoutGk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cascades the 22nd RSVP to team 3 when placing a late GK on full team 1', async () => {
    const team1Ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 12}`)
    const allIds = [...team1Ids, ...team2Ids, 'gk_late']

    const { adminDb, getTeams, getMatch } = createPlaceGkMockDb({
      rsvps: allIds.map((id, index) =>
        makeRsvp(id, index, id === 'gk_late' ? 'GK' : 'ST')
      ),
      teams: [
        makeTeam('team1', 1, team1Ids),
        makeTeam('team2', 2, team2Ids),
        makeTeam('team3', 3, ['gk_late']),
      ],
      match: { id: 'match1', data: {} },
    })

    const rsvpPositions = new Map(
      allIds.map(id => [id, id === 'gk_late' ? 'GK' : 'ST'] as const)
    )
    const userPositions = new Map(allIds.map(id => [id, null] as const))

    const result = await placeGkOnTeamWithoutGk(
      adminDb,
      'match1',
      'gk_late',
      rsvpPositions,
      userPositions
    )

    expect(result.placed).toBe(true)
    expect(result.replacedUserId).toBe('p11')
    expect(result.teamNumber).toBe(1)

    const teams = getTeams()
    const team1 = teams.find(t => t.data.teamNumber === 1)
    const team2 = teams.find(t => t.data.teamNumber === 2)
    const team3 = teams.find(t => t.data.teamNumber === 3)

    expect(team1?.data.playerIds).toContain('gk_late')
    expect(team1?.data.playerIds).not.toContain('p11')
    expect(team1?.data.playerIds).toHaveLength(11)

    expect(team2?.data.playerIds).toContain('p11')
    expect(team2?.data.playerIds).not.toContain('p22')
    expect(team2?.data.playerIds).toHaveLength(11)

    expect(team3?.data.playerIds).toEqual(['p22'])
    expect(getMatch()?.data.gkReplacements).toEqual({ gk_late: 'p11' })
  })

  it('places GK on team 2 and shifts its last player to team 3 when team 1 already has a GK', async () => {
    const team1Ids = [
      'gk1',
      ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`),
    ]
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 11}`)
    const allIds = [...team1Ids, ...team2Ids, 'gk_late']

    const { adminDb, getTeams } = createPlaceGkMockDb({
      rsvps: allIds.map((id, index) =>
        makeRsvp(
          id,
          index,
          id === 'gk_late' || id === 'gk1' ? 'GK' : 'ST'
        )
      ),
      teams: [
        makeTeam('team1', 1, team1Ids),
        makeTeam('team2', 2, team2Ids),
        makeTeam('team3', 3, ['gk_late']),
      ],
      match: { id: 'match1', data: {} },
    })

    const rsvpPositions = new Map(
      allIds.map(
        id =>
          [
            id,
            id === 'gk_late' || id === 'gk1' ? 'GK' : 'ST',
          ] as const
      )
    )

    const result = await placeGkOnTeamWithoutGk(
      adminDb,
      'match1',
      'gk_late',
      rsvpPositions,
      new Map()
    )

    expect(result.placed).toBe(true)
    expect(result.teamNumber).toBe(2)

    const teams = getTeams()
    const team2 = teams.find(t => t.data.teamNumber === 2)
    const team3 = teams.find(t => t.data.teamNumber === 3)
    expect(team2?.data.playerIds).toContain('gk_late')
    expect(team2?.data.playerIds).toHaveLength(11)
    expect(team3?.data.playerIds).toHaveLength(1)
    expect(team3?.data.playerIds).not.toContain('gk_late')
  })

  it('creates team 3 when cascading off full teams 1 and 2', async () => {
    const team1Ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 12}`)
    // GK is not on any team yet (e.g. just changed position while unassigned)
    const allIds = [...team1Ids, ...team2Ids, 'gk_late']

    const { adminDb, getTeams } = createPlaceGkMockDb({
      rsvps: allIds.map((id, index) =>
        makeRsvp(id, index, id === 'gk_late' ? 'GK' : 'ST')
      ),
      teams: [
        makeTeam('team1', 1, team1Ids),
        makeTeam('team2', 2, team2Ids),
      ],
      match: { id: 'match1', data: {} },
    })

    const result = await placeGkOnTeamWithoutGk(
      adminDb,
      'match1',
      'gk_late',
      new Map(allIds.map(id => [id, id === 'gk_late' ? 'GK' : 'ST'] as const)),
      new Map()
    )

    expect(result.placed).toBe(true)
    const teams = getTeams()
    expect(teams.find(t => t.data.teamNumber === 1)?.data.playerIds).toHaveLength(
      11
    )
    expect(teams.find(t => t.data.teamNumber === 2)?.data.playerIds).toHaveLength(
      11
    )
    expect(teams.find(t => t.data.teamNumber === 3)?.data.playerIds).toEqual([
      'p22',
    ])
  })
})
