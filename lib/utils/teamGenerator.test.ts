import { describe, expect, it } from 'vitest'

import { type RSVP } from '@/types/rsvp'
import { type User } from '@/types/user'
import {
  computeTeamCountForRSVPCount,
  generateTeamsWithReplacements,
  isGoalkeeper,
} from './teamGenerator'

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
    const ids = ['gk1', 'gk2', ...Array.from({ length: 20 }, (_, i) => `p${i + 1}`)]
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
      const gkCount = team.playerIds.filter((uid) => {
        const user = users.find((u) => u.uid === uid)
        return isGoalkeeper(user?.position ?? null)
      }).length
      expect(gkCount).toBeLessThanOrEqual(1)
    }
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
    const assignedIds = teams.flatMap((t) => t.playerIds)

    expect(new Set(assignedIds)).toEqual(new Set(ids))
  })
})

