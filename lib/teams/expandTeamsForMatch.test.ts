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
          doc: (id: string) => ({
            id,
            get: async () =>
              makeDocSnap(users.find(user => user.id === id) ?? null),
          }),
        }
      }

      if (path.startsWith('matches/') && path.endsWith('/teams')) {
        const matchId = path.split('/')[1]!
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
            id: matchId,
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
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map(ref => {
        const found = users.find(user => user.id === ref.id) ?? null
        return { id: ref.id, ...makeDocSnap(found) }
      }),
    batch: () => {
      const pendingDeletes: string[] = []
      const pendingWrites: Array<() => Promise<void>> = []
      return {
        update: (
          ref: { update: (data: Record<string, unknown>) => Promise<void> },
          data: Record<string, unknown>
        ) => pendingWrites.push(() => ref.update(data)),
        set: (
          ref: { set: (data: Record<string, unknown>) => Promise<void> },
          data: Record<string, unknown>
        ) => pendingWrites.push(() => ref.set(data)),
        delete: (ref: { id: string }) => {
          pendingDeletes.push(ref.id)
        },
        commit: async () => {
          for (const write of pendingWrites) await write()
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
    expect(
      getTeams().flatMap(t => (t.data.playerIds as string[]) ?? [])
    ).toEqual(expect.arrayContaining(['p1', 'p2']))
  })

  it('does nothing when all RSVPs are already assigned and team count is sufficient', async () => {
    const { adminDb, getTeamUpdates, getTeamSets } = createMockFirestore({
      rsvps: [
        makeRsvpDoc('r1', 'p1', new Date('2024-01-01T10:00:00Z')),
        makeRsvpDoc('r2', 'p2', new Date('2024-01-01T11:00:00Z')),
      ],
      users: [makeUserDoc('p1'), makeUserDoc('p2')],
      teams: [makeTeamDoc('team1', 1, ['p1']), makeTeamDoc('team2', 2, ['p2'])],
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

  it('fills a direct Team 1 hole from assigned later RSVPs before a new arrival', async () => {
    const ids = Array.from({ length: 24 }, (_, i) => `p${i + 1}`)
    const { adminDb, getTeams } = createMockFirestore({
      rsvps: ids.map((id, i) =>
        makeRsvpDoc(id, id, new Date(2024, 0, 1, 0, i))
      ),
      users: ids.map(id => makeUserDoc(id)),
      teams: [
        makeTeamDoc('team1', 1, ids.slice(0, 10)),
        makeTeamDoc('team2', 2, ids.slice(10, 21)),
        makeTeamDoc('team3', 3, ids.slice(21, 23)),
      ],
    })
    await expandTeamsForMatch(adminDb, 'match1')
    const teams = getTeams().sort(
      (a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber)
    )
    expect(teams.map(t => t.data.playerIds)).toEqual([
      [...ids.slice(0, 10), 'p11'],
      [...ids.slice(11, 21), 'p22'],
      ['p23', 'p24'],
    ])
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
      users: allIds.map(id => makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')),
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
      teams: [makeTeamDoc('team1', 1, ['p1']), makeTeamDoc('team2', 2, ['p2'])],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: { p1: 2 } },
      },
    })

    const result = await expandTeamsForMatch(adminDb, 'match1')

    expect(result).toEqual({ regenerated: true })
    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    expect(team1?.data.playerIds).toContain('gk_late')
    expect(team1?.data.playerIds).not.toContain('p1')
    expect(team2?.data.playerIds).toContain('p1')
  })

  it('preserves manualTeamAssignments when GK shifting would bump a pinned player', async () => {
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
      users: allIds.map(id => makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')),
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
    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)
    expect(team1?.data.playerIds).toContain('gk_late')
    expect(team2?.data.playerIds).toContain('p22')
    // Pin keeps p22 on team 2, but capacity is enforced: someone else shifts to team 3.
    expect(team1?.data.playerIds).toHaveLength(11)
    expect(team2?.data.playerIds).toHaveLength(11)
    expect(team3?.data.playerIds).toHaveLength(1)
    expect(team3?.data.playerIds).not.toContain('p22')
    expect(getMatch()?.data.gkReplacements).toEqual({
      gk_late: 'p11',
    })
  })

  it('shifts the 22nd RSVP to team 3 when a late GK is assigned to full team 1', async () => {
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
      users: allIds.map(id => makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')),
      teams: [
        makeTeamDoc('team1', 1, team1Ids),
        makeTeamDoc('team2', 2, team2Ids),
      ],
      match: { id: 'match1', data: {} },
    })

    await expandTeamsForMatch(adminDb, 'match1')

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)
    expect(team1?.data.playerIds).toHaveLength(11)
    expect(team2?.data.playerIds).toHaveLength(11)
    expect(team3?.data.playerIds).toEqual(['p22'])
    expect(team1?.data.playerIds).toContain('gk_late')
  })

  it('does not leave team 1 over capacity when a pinned player would return after GK shift', async () => {
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
      users: allIds.map(id => makeUserDoc(id, id === 'gk_late' ? 'GK' : 'ST')),
      teams: [
        makeTeamDoc('team1', 1, team1Ids),
        makeTeamDoc('team2', 2, team2Ids),
      ],
      match: {
        id: 'match1',
        // p11 is the player GK shift bumps off team 1; pinning them back
        // previously left team 1 with 12 players.
        data: { manualTeamAssignments: { p11: 1 } },
      },
    })

    await expandTeamsForMatch(adminDb, 'match1')

    const team1 = getTeams().find(t => (t.data.teamNumber as number) === 1)
    const team2 = getTeams().find(t => (t.data.teamNumber as number) === 2)
    const team3 = getTeams().find(t => (t.data.teamNumber as number) === 3)
    expect(team1?.data.playerIds).toContain('gk_late')
    expect(team1?.data.playerIds).toContain('p11')
    expect(team1?.data.playerIds).toHaveLength(11)
    expect(team2?.data.playerIds).toHaveLength(11)
    expect(team3?.data.playerIds).toHaveLength(1)
  })

  it.each([false, true])(
    'keeps a goalkeeper on team 2 after a late signup with an outfield pin (existing overflow keepers: %s)',
    async existingKeepers => {
      const team1Ids = [
        'gk1',
        ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`),
      ]
      const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 11}`)
      const overflowIds = existingKeepers ? ['gk2', 'gk3'] : []
      const allIds = [...team1Ids, ...team2Ids, ...overflowIds, 'gk_new']
      const { adminDb, getTeams } = createMockFirestore({
        rsvps: allIds.map((id, index) =>
          makeRsvpDoc(
            `r${index}`,
            id,
            new Date(2024, 0, 1, 0, index),
            'match1',
            id.startsWith('gk') ? 'GK' : 'ST'
          )
        ),
        // The match RSVP must win over an outfield profile position.
        users: allIds.map(id => makeUserDoc(id, 'ST')),
        teams: [
          makeTeamDoc('team1', 1, team1Ids),
          makeTeamDoc('team2', 2, team2Ids),
          makeTeamDoc('team3', 3, overflowIds),
        ],
        match: { id: 'match1', data: { manualTeamAssignments: { p21: 2 } } },
      })

      await expandTeamsForMatch(adminDb, 'match1')

      const teams = getTeams().sort(
        (a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber)
      )
      const rosters = teams.map(t => t.data.playerIds as string[])
      expect(rosters[0]).toEqual(team1Ids)
      expect(rosters[1]).toContain(existingKeepers ? 'gk2' : 'gk_new')
      expect(rosters[1]).toContain('p21')
      expect(rosters[1].filter(id => id.startsWith('gk'))).toHaveLength(1)
      expect(rosters.map(ids => ids.length)).toEqual([
        11,
        11,
        allIds.length - 22,
      ])
      expect(rosters.flat().sort()).toEqual([...allIds].sort())
    }
  )

  it.each([true, false])(
    'preserves the sole keeper during forced regeneration (RSVP position: %s)',
    async useRsvpPosition => {
      const team1 = [
        'gk1',
        ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`),
      ]
      const outfield2 = Array.from({ length: 11 }, (_, i) => `p${i + 11}`)
      const ids = [...team1, ...outfield2, 'gk2', 'gk3']
      const { adminDb, getTeams } = createMockFirestore({
        rsvps: ids.map((id, index) =>
          makeRsvpDoc(
            `r${index}`,
            id,
            new Date(Date.UTC(2024, 0, 1, 0, index)),
            'match1',
            useRsvpPosition ? (id.startsWith('gk') ? 'GK' : 'ST') : null
          )
        ),
        users: ids.map(id =>
          makeUserDoc(id, !useRsvpPosition && id.startsWith('gk') ? 'GK' : 'ST')
        ),
        teams: [
          makeTeamDoc('team1', 1, team1),
          makeTeamDoc('team2', 2, [...outfield2.slice(0, 10), 'gk2']),
          makeTeamDoc('team3', 3, ['p21', 'gk3']),
        ],
        match: { id: 'match1', data: { manualTeamAssignments: { p21: 2 } } },
      })
      await expandTeamsForMatch(adminDb, 'match1', { forceRegenerate: true })
      const rosters = getTeams()
        .sort((a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber))
        .map(t => t.data.playerIds as string[])
      expect(rosters[1]).toContain('gk2')
      expect(rosters[1]).toContain('p21')
      expect(rosters.map(ids => ids.length)).toEqual([11, 11, 2])
      expect(
        rosters.map(ids => ids.filter(id => id.startsWith('gk')).length)
      ).toEqual([1, 1, 1])
      expect(rosters.flat().sort()).toEqual([...ids].sort())
    }
  )

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

  it('restoreRsvpOrder undoes rebalance skew; force-regenerate keeps it', async () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i + 1}`)
    const rebalancedTeam1 = ids.slice(0, 7)
    const rebalancedTeam2 = ids.slice(7)
    const { adminDb, getTeams } = createMockFirestore({
      rsvps: ids.map((id, index) =>
        makeRsvpDoc(
          `r${index + 1}`,
          id,
          new Date(Date.UTC(2024, 0, 1, 10, index))
        )
      ),
      users: ids.map(id => makeUserDoc(id)),
      teams: [
        makeTeamDoc('team1', 1, rebalancedTeam1),
        makeTeamDoc('team2', 2, rebalancedTeam2),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: {} },
      },
    })

    // Plain force-regenerate treats 7/7 as implied transfers and keeps it.
    await expandTeamsForMatch(adminDb, 'match1', { forceRegenerate: true })
    expect(
      getTeams()
        .sort((a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber))
        .map(t => (t.data.playerIds as string[]).length)
    ).toEqual([7, 7])

    const result = await expandTeamsForMatch(adminDb, 'match1', {
      restoreRsvpOrder: true,
    })
    expect(result).toEqual({ regenerated: true })

    const teams = getTeams().sort(
      (a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber)
    )
    expect(teams.map(t => (t.data.playerIds as string[]).length)).toEqual([
      11, 3,
    ])
    expect(teams[0]?.data.playerIds).toEqual(ids.slice(0, 11))
    expect(teams[1]?.data.playerIds).toEqual(ids.slice(11))
  })

  it('restoreRsvpOrder re-applies saved pins onto RSVP-order baseline', async () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i + 1}`)
    const { adminDb, getTeams } = createMockFirestore({
      rsvps: ids.map((id, index) =>
        makeRsvpDoc(
          `r${index + 1}`,
          id,
          new Date(Date.UTC(2024, 0, 1, 10, index))
        )
      ),
      users: ids.map(id => makeUserDoc(id)),
      teams: [
        makeTeamDoc('team1', 1, ids.slice(0, 7)),
        makeTeamDoc('team2', 2, ids.slice(7)),
      ],
      match: {
        id: 'match1',
        data: { manualTeamAssignments: { p14: 1 } },
      },
    })

    const result = await expandTeamsForMatch(adminDb, 'match1', {
      restoreRsvpOrder: true,
    })
    expect(result).toEqual({ regenerated: true })

    const teams = getTeams().sort(
      (a, b) => Number(a.data.teamNumber) - Number(b.data.teamNumber)
    )
    const team1 = teams[0]?.data.playerIds as string[]
    const team2 = teams[1]?.data.playerIds as string[]
    expect(team1).toContain('p14')
    expect(team2).not.toContain('p14')
    expect(team1).toHaveLength(11)
    expect(team2).toHaveLength(3)
  })
})
