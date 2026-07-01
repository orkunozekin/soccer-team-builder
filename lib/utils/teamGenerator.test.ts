import { describe, expect, it } from 'vitest'
import {
  applyManualTeamTransfers,
  assignUnassignedPlayersToTeams,
  computeTeamCountForRSVPCount,
  deriveManualTransfers,
  generateTeamsWithReplacements,
  isGoalkeeper,
  mergeBaselineWithManualTransfers,
  mergeManualTransfers,
} from './teamGenerator'
import { type RSVP } from '@/types/rsvp'
import { type User } from '@/types/user'

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    uid: id,
    email: `${id}@example.com`,
    displayName: id,
    jerseyNumber: null,
    position: null,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeRSVP(id: string, overrides: Partial<RSVP> = {}): RSVP {
  const now = new Date()
  return {
    id: `rsvp_${id}`,
    matchId: 'match1',
    userId: id,
    status: 'confirmed',
    position: null,
    rsvpAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function positionForId(id: string): string {
  return id.startsWith('gk') ? 'GK' : 'ST'
}

function buildRoster(
  ids: string[],
  options?: {
    rsvpAt?: (id: string, index: number) => Date
    userPosition?: (id: string) => string | null
    rsvpPosition?: (id: string) => string | null
  }
): { users: User[]; rsvps: RSVP[] } {
  const users: User[] = []
  const rsvps: RSVP[] = []
  ids.forEach((id, index) => {
    users.push(
      makeUser(id, {
        position:
          options?.userPosition?.(id) ?? positionForId(id),
      })
    )
    rsvps.push(
      makeRSVP(id, {
        rsvpAt:
          options?.rsvpAt?.(id, index) ??
          new Date(2024, 0, 1, 0, index),
        position: options?.rsvpPosition?.(id) ?? null,
      })
    )
  })
  return { users, rsvps }
}

function teamHasGoalkeeper(
  team: { playerIds: string[] },
  users: User[],
  rsvps: RSVP[]
): boolean {
  const rsvpByUser = new Map(rsvps.map(r => [r.userId, r]))
  return team.playerIds.some(uid => {
    const user = users.find(u => u.uid === uid)
    const rsvp = rsvpByUser.get(uid)
    const pos = rsvp?.position ?? user?.position ?? null
    return isGoalkeeper(pos)
  })
}

describe('isGoalkeeper', () => {
  it('returns true for goalkeeper-like positions', () => {
    expect(isGoalkeeper('GK')).toBe(true)
    expect(isGoalkeeper('goalkeeper')).toBe(true)
    expect(isGoalkeeper('Goalie')).toBe(true)
    expect(isGoalkeeper(' keeper ')).toBe(true)
    expect(isGoalkeeper('Senior Goalkeeper')).toBe(true)
  })

  it('returns false for non-goalkeeper positions or null', () => {
    expect(isGoalkeeper(null)).toBe(false)
    expect(isGoalkeeper('')).toBe(false)
    expect(isGoalkeeper('ST')).toBe(false)
    expect(isGoalkeeper('CM')).toBe(false)
  })
})

describe('computeTeamCountForRSVPCount', () => {
  it('keeps at least two teams and scales with RSVPs', () => {
    expect(computeTeamCountForRSVPCount(0)).toBe(2)
    expect(computeTeamCountForRSVPCount(10)).toBe(2)
    expect(computeTeamCountForRSVPCount(22)).toBe(2)
    expect(computeTeamCountForRSVPCount(23)).toBe(3)
    expect(computeTeamCountForRSVPCount(44)).toBe(4)
    expect(computeTeamCountForRSVPCount(45)).toBe(5)
  })
})

describe('generateTeamsWithReplacements', () => {
  it('limits first two teams to at most one goalkeeper each', () => {
    const users: User[] = []
    const rsvps: RSVP[] = []

    // Two goalkeepers and 20 outfield players
    const ids = [
      'gk1',
      'gk2',
      ...Array.from({ length: 20 }, (_, i) => `p${i + 1}`),
    ]
    ids.forEach((id, index) => {
      const isGk = id.startsWith('gk')
      users.push(
        makeUser(id, {
          position: isGk ? 'GK' : 'ST',
        })
      )
      rsvps.push(
        makeRSVP(id, {
          rsvpAt: new Date(2024, 0, 1, 0, index),
        })
      )
    })

    const { teams } = generateTeamsWithReplacements(rsvps, users, 11)

    expect(teams.length).toBeGreaterThanOrEqual(2)

    const firstTwo = teams.slice(0, 2)
    for (const team of firstTwo) {
      const gkCount = team.playerIds.filter(uid => {
        const user = users.find(u => u.uid === uid)
        return isGoalkeeper(user?.position ?? null)
      }).length
      expect(gkCount).toBeLessThanOrEqual(1)
    }
  })

  it('moves goalkeepers from later teams onto earlier teams that lack one', () => {
    // 22 outfield fill teams 1–2; both GKs RSVP last and land on team 3
    const outfield = Array.from({ length: 22 }, (_, i) => `p${i + 1}`)
    const ids = [...outfield, 'gk1', 'gk2']
    const { users, rsvps } = buildRoster(ids)

    const { teams } = generateTeamsWithReplacements(rsvps, users, 11)

    expect(teams.length).toBeGreaterThanOrEqual(3)
    expect(teamHasGoalkeeper(teams[0]!, users, rsvps)).toBe(true)
    expect(teamHasGoalkeeper(teams[1]!, users, rsvps)).toBe(true)
    expect(teams[0]!.playerIds).toContain('gk1')
    expect(teams[1]!.playerIds).toContain('gk2')
  })

  it('records gkReplacements when shifting a GK onto a team without one', () => {
    const outfield = Array.from({ length: 22 }, (_, i) => `p${i + 1}`)
    const ids = [...outfield, 'gk1', 'gk2']
    const { users, rsvps } = buildRoster(ids)

    const { teams, gkReplacements } = generateTeamsWithReplacements(
      rsvps,
      users,
      11
    )

    expect(gkReplacements).toEqual([
      { insertedGK: 'gk1', removedPlayer: 'p11' },
      { insertedGK: 'gk2', removedPlayer: 'p21' },
    ])
    expect(teams[0]!.playerIds).toContain('gk1')
    expect(teams[0]!.playerIds).not.toContain('p11')
    expect(teams[1]!.playerIds).toContain('gk2')
    expect(teams[1]!.playerIds).not.toContain('p21')
  })

  it('pulls the earliest-RSVP goalkeeper from later teams when filling a gap', () => {
    const outfield = Array.from({ length: 22 }, (_, i) => `p${i + 1}`)
    const ids = [...outfield, 'gk_late', 'gk_early']
    const { users, rsvps } = buildRoster(ids, {
      rsvpAt: (id, index) => {
        if (id === 'gk_early') return new Date(2024, 0, 1, 12, 0)
        if (id === 'gk_late') return new Date(2024, 0, 1, 12, 30)
        return new Date(2024, 0, 1, 0, index)
      },
    })

    const { teams } = generateTeamsWithReplacements(rsvps, users, 11)

    expect(teams[0]!.playerIds).toContain('gk_early')
    expect(teams[0]!.playerIds).not.toContain('gk_late')
  })

  it('does not add a second goalkeeper to a team that already has one', () => {
    const ids = [
      'gk1',
      'gk2',
      ...Array.from({ length: 20 }, (_, i) => `p${i + 1}`),
    ]
    const { users, rsvps } = buildRoster(ids)

    const { teams } = generateTeamsWithReplacements(rsvps, users, 11)

    for (const team of teams.slice(0, 2)) {
      const gkCount = team.playerIds.filter(uid =>
        isGoalkeeper(users.find(u => u.uid === uid)?.position ?? null)
      ).length
      expect(gkCount).toBe(1)
    }
  })

  it('treats RSVP position as goalkeeper when profile position is not GK', () => {
    const outfield = Array.from({ length: 22 }, (_, i) => `p${i + 1}`)
    const ids = [...outfield, 'gk1']
    const { users, rsvps } = buildRoster(ids, {
      userPosition: () => 'ST',
      rsvpPosition: id => (id === 'gk1' ? 'GK' : null),
    })

    const { teams, gkReplacements } = generateTeamsWithReplacements(
      rsvps,
      users,
      11
    )

    expect(teamHasGoalkeeper(teams[0]!, users, rsvps)).toBe(true)
    expect(teams[0]!.playerIds).toContain('gk1')
    expect(gkReplacements).toContainEqual({
      insertedGK: 'gk1',
      removedPlayer: 'p11',
    })
  })

  it('ensures all players are assigned to some team', () => {
    const users: User[] = []
    const rsvps: RSVP[] = []

    const ids = Array.from({ length: 15 }, (_, i) => `p${i + 1}`)
    ids.forEach((id, index) => {
      users.push(
        makeUser(id, {
          position: 'ST',
        })
      )
      rsvps.push(
        makeRSVP(id, {
          rsvpAt: new Date(2024, 0, 1, 0, index),
        })
      )
    })

    const { teams } = generateTeamsWithReplacements(rsvps, users, 11)
    const assignedIds = teams.flatMap(t => t.playerIds)

    expect(new Set(assignedIds)).toEqual(new Set(ids))
  })
})

describe('assignUnassignedPlayersToTeams', () => {
  it('preserves existing team assignments when placing new RSVPs', () => {
    const { users, rsvps } = buildRoster(
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    )

    const existingTeams = [
      { teamNumber: 1, playerIds: ['p2', 'p1', 'p4'] },
      { teamNumber: 2, playerIds: ['p3', 'p5'] },
    ]
    const unassigned = rsvps.filter(r => r.userId === 'p6')

    const result = assignUnassignedPlayersToTeams(
      existingTeams,
      unassigned,
      rsvps,
      users,
      11,
      2
    )

    expect(result[0]?.playerIds).toEqual(['p2', 'p1', 'p4', 'p6'])
    expect(result[1]?.playerIds).toEqual(['p3', 'p5'])
  })

  it('places overflow players on a new team without reshuffling existing rosters', () => {
    const team1Ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const team2Ids = Array.from({ length: 11 }, (_, i) => `p${i + 12}`)
    const allIds = [...team1Ids, ...team2Ids, 'p23']
    const { users, rsvps } = buildRoster(allIds)

    const existingTeams = [
      { teamNumber: 1, playerIds: [...team1Ids] },
      { teamNumber: 2, playerIds: [...team2Ids] },
    ]
    const unassigned = rsvps.filter(r => r.userId === 'p23')

    const result = assignUnassignedPlayersToTeams(
      existingTeams,
      unassigned,
      rsvps,
      users,
      11,
      3
    )

    expect(result[0]?.playerIds).toEqual(team1Ids)
    expect(result[1]?.playerIds).toEqual(team2Ids)
    expect(result[2]?.playerIds).toEqual(['p23'])
  })

  it('respects GK limits on teams 1 and 2 for new players', () => {
    const { users, rsvps } = buildRoster(['p1', 'gk1', 'gk2', 'p2', 'p3'], {
      userPosition: id => (id.startsWith('gk') ? 'GK' : 'ST'),
    })

    const existingTeams = [
      { teamNumber: 1, playerIds: ['gk1', 'p1'] },
      { teamNumber: 2, playerIds: ['p2'] },
    ]
    const unassigned = rsvps.filter(r =>
      ['gk2', 'p3'].includes(r.userId)
    )

    const result = assignUnassignedPlayersToTeams(
      existingTeams,
      unassigned,
      rsvps,
      users,
      11,
      2
    )

    expect(result[0]?.playerIds).toEqual(['gk1', 'p1', 'p3'])
    expect(result[1]?.playerIds).toEqual(['p2', 'gk2'])
  })
})

describe('deriveManualTransfers and applyManualTeamTransfers', () => {
  it('detects players on a different team than RSVP-order baseline', () => {
    const { users, rsvps } = buildRoster(['p1', 'p2', 'p3', 'p4'])
    const { teams: baseline } = generateTeamsWithReplacements(rsvps, users, 11, {
      teamCount: 2,
    })

    const currentTeams = baseline.map(t => ({
      teamNumber: t.teamNumber,
      playerIds: [...t.playerIds],
    }))
    const movedPlayer = currentTeams[0]!.playerIds[0]!
    currentTeams[0]!.playerIds = currentTeams[0]!.playerIds.filter(
      id => id !== movedPlayer
    )
    currentTeams[1]!.playerIds.push(movedPlayer)

    const manual = deriveManualTransfers(currentTeams, baseline)
    expect(manual.get(movedPlayer)).toBe(2)

    const restored = applyManualTeamTransfers(baseline, manual)
    expect(restored[1]?.playerIds).toContain(movedPlayer)
    expect(restored[0]?.playerIds).not.toContain(movedPlayer)
  })

  it('returns an empty map when current teams match the baseline', () => {
    const { users, rsvps } = buildRoster(['p1', 'p2', 'p3', 'p4'])
    const { teams: baseline } = generateTeamsWithReplacements(rsvps, users, 11, {
      teamCount: 2,
    })

    const manual = deriveManualTransfers(baseline, baseline)
    expect(manual.size).toBe(0)
  })

  it('preserves a two-player swap across regeneration', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3', 'p4'] },
    ]
    const currentTeams = [
      { teamNumber: 1, playerIds: ['p3', 'p2'] },
      { teamNumber: 2, playerIds: ['p1', 'p4'] },
    ]

    const manual = deriveManualTransfers(currentTeams, baseline)
    const regenerated = applyManualTeamTransfers(baseline, manual)

    expect(regenerated[0]?.playerIds).toEqual(
      expect.arrayContaining(['p2', 'p3'])
    )
    expect(regenerated[0]?.playerIds).not.toContain('p1')
    expect(regenerated[1]?.playerIds).toEqual(
      expect.arrayContaining(['p1', 'p4'])
    )
    expect(regenerated[1]?.playerIds).not.toContain('p3')
  })
})

describe('applyManualTeamTransfers', () => {
  it('returns a shallow copy when there are no manual transfers', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3'] },
    ]

    const result = applyManualTeamTransfers(baseline, new Map())

    expect(result).toEqual(baseline)
    expect(result).not.toBe(baseline)
    expect(result[0]?.playerIds).not.toBe(baseline[0]?.playerIds)
  })

  it('creates a target team when it does not exist in the baseline', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3'] },
    ]

    const result = applyManualTeamTransfers(
      baseline,
      new Map([['p1', 3]])
    )

    expect(result.find(t => t.teamNumber === 3)?.playerIds).toEqual(['p1'])
    expect(result.find(t => t.teamNumber === 1)?.playerIds).toEqual(['p2'])
  })
})

describe('mergeManualTransfers', () => {
  it('merges persisted manual assignments with current-state diff', () => {
    const manual = mergeManualTransfers(new Map([['p1', 2]]), { p2: 1 })
    expect(manual.get('p1')).toBe(2)
    expect(manual.get('p2')).toBe(1)
  })

  it('lets persisted assignments override diff entries for the same player', () => {
    const manual = mergeManualTransfers(new Map([['p1', 2]]), { p1: 3 })
    expect(manual.get('p1')).toBe(3)
  })

  it('ignores invalid persisted team numbers', () => {
    const manual = mergeManualTransfers(new Map([['p1', 2]]), {
      p2: NaN,
      p3: 'bad' as unknown as number,
    })
    expect(manual.get('p1')).toBe(2)
    expect(manual.has('p2')).toBe(false)
    expect(manual.has('p3')).toBe(false)
  })
})

describe('mergeBaselineWithManualTransfers', () => {
  it('preserves a two-player swap onto a rebalance baseline', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3', 'p4'] },
      { teamNumber: 3, playerIds: ['p5', 'p6'] },
    ]
    const currentTeams = [
      { teamNumber: 1, playerIds: ['p2', 'p3'] },
      { teamNumber: 2, playerIds: ['p1', 'p4'] },
      { teamNumber: 3, playerIds: ['p5', 'p6'] },
    ]

    const result = mergeBaselineWithManualTransfers(currentTeams, baseline)

    const team1 = result.find(t => t.teamNumber === 1)
    const team2 = result.find(t => t.teamNumber === 2)
    expect(team1?.playerIds).toEqual(expect.arrayContaining(['p2', 'p3']))
    expect(team1?.playerIds).not.toContain('p1')
    expect(team2?.playerIds).toEqual(expect.arrayContaining(['p1', 'p4']))
    expect(team2?.playerIds).not.toContain('p3')
  })

  it('uses persisted manualTeamAssignments when current rosters already match baseline', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3', 'p4'] },
    ]
    const currentTeams = baseline.map(t => ({
      teamNumber: t.teamNumber,
      playerIds: [...t.playerIds],
    }))

    const result = mergeBaselineWithManualTransfers(currentTeams, baseline, {
      p1: 2,
    })

    expect(result.find(t => t.teamNumber === 1)?.playerIds).not.toContain('p1')
    expect(result.find(t => t.teamNumber === 2)?.playerIds).toContain('p1')
  })

  it('lets persisted assignments override the current-vs-baseline diff', () => {
    const baseline = [
      { teamNumber: 1, playerIds: ['p1', 'p2'] },
      { teamNumber: 2, playerIds: ['p3'] },
      { teamNumber: 3, playerIds: ['p4'] },
    ]
    const currentTeams = [
      { teamNumber: 1, playerIds: ['p2'] },
      { teamNumber: 2, playerIds: ['p1', 'p3'] },
      { teamNumber: 3, playerIds: ['p4'] },
    ]

    const result = mergeBaselineWithManualTransfers(currentTeams, baseline, {
      p1: 3,
    })

    expect(result.find(t => t.teamNumber === 2)?.playerIds).not.toContain('p1')
    expect(result.find(t => t.teamNumber === 3)?.playerIds).toContain('p1')
  })
})

describe('regeneration with manual transfers', () => {
  it('re-applies explicit transfers onto a fresh RSVP-order baseline', () => {
    const { users, rsvps } = buildRoster(
      Array.from({ length: 6 }, (_, i) => `p${i + 1}`)
    )
    const { teams: baseline } = generateTeamsWithReplacements(rsvps, users, 11, {
      teamCount: 2,
    })

    const transferredPlayer = baseline[0]!.playerIds[0]!
    const currentTeams = baseline.map(t => ({
      teamNumber: t.teamNumber,
      playerIds: [...t.playerIds],
    }))
    currentTeams[0]!.playerIds = currentTeams[0]!.playerIds.filter(
      id => id !== transferredPlayer
    )
    currentTeams[1]!.playerIds.push(transferredPlayer)

    const manual = mergeManualTransfers(
      deriveManualTransfers(currentTeams, baseline),
      { [transferredPlayer]: 2 }
    )
    const regenerated = applyManualTeamTransfers(baseline, manual)

    expect(regenerated[1]?.playerIds).toContain(transferredPlayer)
    expect(regenerated[0]?.playerIds).not.toContain(transferredPlayer)

    const allAssigned = regenerated.flatMap(t => t.playerIds)
    expect(new Set(allAssigned).size).toBe(allAssigned.length)
    expect(allAssigned).toHaveLength(6)
  })
})
