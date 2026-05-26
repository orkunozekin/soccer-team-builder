import { describe, expect, it } from 'vitest'
import {
  computeTeamCountForRSVPCount,
  generateTeamsWithReplacements,
  isGoalkeeper,
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
