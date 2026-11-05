import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { verifyClubAdminForMatch } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { auditLog } from '@/lib/services/auditService'
import { getEffectiveSkillScoresForClub } from '@/lib/skill/skillStoreAdmin'

vi.mock('@/lib/api/auth', () => ({
  verifyClubAdminForMatch: vi.fn(),
}))

vi.mock('@/lib/flags/evaluateFeatureFlag', () => ({
  evaluateFeatureFlag: vi.fn(),
}))

vi.mock('@/lib/skill/skillStoreAdmin', () => ({
  getEffectiveSkillScoresForClub: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
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
          doc: (id: string) => ({ id }),
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
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map(ref => {
        const found = initial.users.find(user => user.id === ref.id) ?? null
        return { id: ref.id, ...makeDocSnap(found) }
      }),
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
    vi.mocked(evaluateFeatureFlag).mockReset().mockResolvedValue(false)
    vi.mocked(getEffectiveSkillScoresForClub).mockReset()
    vi.mocked(auditLog).mockReset()
    vi.mocked(verifyClubAdminForMatch).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      matchExists: true,
      isSuperUser: true,
      clubId: null,
      error: null,
    })
  })

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'preserves goalkeeper priority after rebalance (already repaired: %s, admin pin: %s)',
    async (alreadyRepaired, hasPin) => {
      const team1 = [
        'gk1',
        ...Array.from({ length: 10 }, (_, i) => `p${i + 1}`),
      ]
      const team2 = Array.from({ length: 11 }, (_, i) => `p${i + 11}`)
      const overflow = ['gk2', 'gk3', 'gk_new']
      const allIds = [...team1, ...team2, ...overflow]
      const rsvps = allIds.map((id, index) => {
        const rsvp = makeRsvpDoc(
          `r${index}`,
          id,
          new Date(Date.UTC(2024, 0, 1, 0, index))
        )
        rsvp.data.position = id.startsWith('gk') ? 'GK' : 'ST'
        return rsvp
      })
      const { adminDb, getTeams } = createRebalanceMockRepos({
        rsvps,
        users: allIds.map(id => makeUserDoc(id, 'ST')),
        teams: [
          makeTeamDoc('team1', 1, team1),
          makeTeamDoc(
            'team2',
            2,
            alreadyRepaired
              ? team2.map(id => (id === 'p20' ? 'gk2' : id))
              : team2
          ),
          makeTeamDoc(
            'team3',
            3,
            alreadyRepaired ? ['p20', 'gk3', 'gk_new'] : overflow
          ),
        ],
        match: {
          id: 'match1',
          data: { manualTeamAssignments: hasPin ? { p21: 2 } : {} },
        },
      })
      vi.mocked(getAdminDb).mockReturnValue(adminDb as never)

      const response = await POST(makeRequest())
      const body = await response.json()
      const rosters = getTeams().map(t => t.data.playerIds as string[])
      expect(response.status).toBe(200)
      expect(body.assignedCounts).toEqual([11, 11, 3])
      expect(
        rosters.map(ids => ids.filter(id => id.startsWith('gk')).length)
      ).toEqual([1, 1, 2])
      expect(rosters.flat().sort()).toEqual([...allIds].sort())
      if (hasPin) expect(rosters[1]).toContain('p21')
    }
  )

  it.each(['GK', null, 'ST'])(
    'uses RSVP position %s before a goalkeeper profile and distributes early keepers',
    async position => {
      const ids = ['gk1', 'gk2', 'p1', 'p2', 'p3', 'p4']
      const rsvps = ids.map((id, index) => {
        const rsvp = makeRsvpDoc(
          `r${index}`,
          id,
          new Date(Date.UTC(2024, 0, 1, 0, index))
        )
        rsvp.data.position = id.startsWith('gk') ? position : 'ST'
        return rsvp
      })
      const { adminDb, getTeams } = createRebalanceMockRepos({
        rsvps,
        users: ids.map(id =>
          makeUserDoc(id, id.startsWith('gk') ? 'GK' : 'ST')
        ),
        teams: [makeTeamDoc('team1', 1, ids), makeTeamDoc('team2', 2, [])],
      })
      vi.mocked(getAdminDb).mockReturnValue(adminDb as never)
      const response = await POST(makeRequest())
      expect(response.status).toBe(200)
      const rosters = getTeams().map(t => t.data.playerIds as string[])
      expect(rosters.map(ids => ids.length)).toEqual([3, 3])
      expect(rosters.flat().sort()).toEqual([...ids].sort())
      if (position === 'ST') {
        expect(rosters[0]).toEqual(ids.slice(0, 3))
      } else {
        expect(
          rosters.map(ids => ids.filter(id => id.startsWith('gk')).length)
        ).toEqual([1, 1])
      }
    }
  )

  it('returns 401 when not authenticated', async () => {
    vi.mocked(verifyClubAdminForMatch).mockResolvedValue({
      uid: null,
      isClubAdmin: false,
      matchExists: true,
      isSuperUser: false,
      clubId: null,
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
    const positions = [
      'ST',
      'CB',
      'CM',
      'CAM',
      'LW',
      'RB',
      'CDM',
      'LWB',
      'RW',
      'LB',
      'GK',
    ]
    const rsvps = playerIds.map((id, i) =>
      makeRsvpDoc(`r${i + 1}`, id, new Date(Date.UTC(2024, 0, 1, 10, i)))
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

describe('POST /api/teams/rebalance (skill-balanced-teams)', () => {
  // RSVP order: gk1, p2..p8. Size balance alone gives Team 1 = gk1,p2,p3,p4
  // (2+4+4+4 = 14) and Team 2 = p5..p8 (1+1+1+1 = 4).
  const ids = ['gk1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
  const scores = new Map<string, number>([
    ['gk1', 2],
    ['p2', 4],
    ['p3', 4],
    ['p4', 4],
    ['p5', 1],
    ['p6', 1],
    ['p7', 1],
    ['p8', 1],
  ])

  function setup(manualTeamAssignments: Record<string, number> = {}) {
    const rsvps = ids.map((id, index) => {
      const rsvp = makeRsvpDoc(
        `r${index}`,
        id,
        new Date(Date.UTC(2024, 0, 1, 0, index))
      )
      rsvp.data.position = id === 'gk1' ? 'GK' : 'ST'
      return rsvp
    })
    const repos = createRebalanceMockRepos({
      rsvps,
      users: ids.map(id => makeUserDoc(id, id === 'gk1' ? 'GK' : 'ST')),
      teams: [
        makeTeamDoc('team1', 1, ids.slice(0, 4)),
        makeTeamDoc('team2', 2, ids.slice(4)),
      ],
      match: {
        id: 'match1',
        data: { clubId: 'club1', manualTeamAssignments },
      },
    })
    vi.mocked(getAdminDb).mockReturnValue(repos.adminDb as never)
    return repos
  }

  const rosterOf = (
    repos: ReturnType<typeof setup>,
    teamNumber: number
  ): string[] =>
    (repos.getTeams().find(t => t.data.teamNumber === teamNumber)?.data
      .playerIds as string[]) ?? []

  const totalOf = (playerIds: string[]) =>
    playerIds.reduce((sum, id) => sum + (scores.get(id) ?? 0), 0)

  beforeEach(() => {
    vi.mocked(evaluateFeatureFlag).mockReset().mockResolvedValue(false)
    vi.mocked(getEffectiveSkillScoresForClub)
      .mockReset()
      .mockResolvedValue({ scoreByUserId: scores, unratedUserIds: ['p8'] })
    vi.mocked(auditLog).mockReset()
    vi.mocked(verifyClubAdminForMatch).mockResolvedValue({
      uid: 'admin1',
      email: 'admin1@example.com',
      isClubAdmin: true,
      matchExists: true,
      isSuperUser: false,
      clubId: 'club1',
      error: null,
    })
  })

  it('keeps the size-balanced result and omits strength when the flag is off', async () => {
    const repos = setup()
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(evaluateFeatureFlag).toHaveBeenCalledWith('skill-balanced-teams', {
      key: 'admin1',
      email: 'admin1@example.com',
    })
    expect(getEffectiveSkillScoresForClub).not.toHaveBeenCalled()
    expect(body).not.toHaveProperty('strength')
    expect(rosterOf(repos, 1)).toEqual(ids.slice(0, 4))
    expect(rosterOf(repos, 2)).toEqual(ids.slice(4))
    expect(vi.mocked(auditLog).mock.calls[0]?.[0].metadata).toMatchObject({
      skillBalanced: false,
    })
  })

  it('skips skill balancing for a match without a clubId', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    vi.mocked(verifyClubAdminForMatch).mockResolvedValue({
      uid: 'admin1',
      isClubAdmin: true,
      matchExists: true,
      isSuperUser: true,
      clubId: null,
      error: null,
    })
    const repos = setup()
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(evaluateFeatureFlag).not.toHaveBeenCalled()
    expect(getEffectiveSkillScoresForClub).not.toHaveBeenCalled()
    expect(body).not.toHaveProperty('strength')
    expect(rosterOf(repos, 1)).toEqual(ids.slice(0, 4))
  })

  it('swaps players within the pair to even skill and reports strength', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    const repos = setup()
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getEffectiveSkillScoresForClub).toHaveBeenCalledWith(
      repos.adminDb,
      'club1',
      expect.arrayContaining(ids)
    )
    const team1 = rosterOf(repos, 1)
    const team2 = rosterOf(repos, 2)
    // Same players, same sizes; only the split changed.
    expect(body.assignedCounts).toEqual([4, 4])
    expect([...team1, ...team2].sort()).toEqual([...ids].sort())
    // gk1 is locked on Team 1; best split is 2+4+1+1 = 8 vs 4+4+1+1 = 10.
    expect(team1).toContain('gk1')
    expect(totalOf(team1)).toBe(8)
    expect(totalOf(team2)).toBe(10)
    expect(body.strength).toEqual({
      teams: [
        { teamNumber: 1, total: 8, average: 2, size: 4 },
        { teamNumber: 2, total: 10, average: 2.5, size: 4 },
      ],
      unratedCount: 1,
      playerCount: 8,
    })
    expect(repos.getMatchData().manualTeamAssignments).toEqual({})
    expect(vi.mocked(auditLog).mock.calls[0]?.[0].metadata).toMatchObject({
      skillBalanced: true,
      assignedCounts: [4, 4],
    })
  })

  it('never moves pinned players or goalkeepers and adds no pins', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    // p3 and p4 pinned to Team 1 would otherwise be swapped out.
    const pins = { p3: 1, p4: 1 }
    const repos = setup(pins)
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    const team1 = rosterOf(repos, 1)
    const team2 = rosterOf(repos, 2)
    expect(team1).toEqual(expect.arrayContaining(['gk1', 'p3', 'p4']))
    expect(team2).toContain('p2')
    expect(team1).toHaveLength(4)
    expect(team2).toHaveLength(4)
    expect(body.strength.teams.map((t: { size: number }) => t.size)).toEqual([
      4, 4,
    ])
    expect(repos.getMatchData().manualTeamAssignments).toEqual(pins)
  })

  it('falls back to the size-balanced result when skill data fails to load', async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true)
    vi.mocked(getEffectiveSkillScoresForClub).mockRejectedValue(
      new Error('firestore unavailable')
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const repos = setup()
    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body).not.toHaveProperty('strength')
    expect(rosterOf(repos, 1)).toEqual(ids.slice(0, 4))
    expect(rosterOf(repos, 2)).toEqual(ids.slice(4))
    expect(errorSpy).toHaveBeenCalled()
    expect(vi.mocked(auditLog).mock.calls[0]?.[0].metadata).toMatchObject({
      skillBalanced: false,
    })
    errorSpy.mockRestore()
  })
})
