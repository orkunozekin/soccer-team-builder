import { describe, expect, it } from 'vitest'
import {
  assignPitchSlots,
  getTeamPositionOccupancy,
  mapToHalfPitch,
  POSITION_COORDINATES,
} from './pitchLayout'
import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

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

function makeRSVP(
  userId: string,
  rsvpAt: Date,
  overrides: Partial<RSVP> = {}
): RSVP {
  return {
    id: `rsvp_${userId}`,
    matchId: 'match1',
    userId,
    status: 'confirmed',
    position: null,
    jerseyNumber: null,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
    rsvpAt,
    updatedAt: rsvpAt,
    ...overrides,
  }
}

function makeTeam(playerIds: string[]): Team {
  return {
    id: 'team1',
    matchId: 'match1',
    teamNumber: 1,
    name: 'Team 1',
    color: '#1e40af',
    playerIds,
    maxSize: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('assignPitchSlots', () => {
  it('places a single player at the canonical preferred slot', () => {
    const users = [makeUser('a', { position: 'ST' })]
    const team = makeTeam(['a'])
    const result = assignPitchSlots(team, users, [
      makeRSVP('a', new Date('2024-01-01T10:00:00Z')),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].assignedSlot).toBe('ST')
    expect(result[0].position).toEqual(POSITION_COORDINATES.ST)
  })

  it('gives canonical slot to earliest rsvpAt when positions collide', () => {
    const users = [
      makeUser('late', { position: 'CB' }),
      makeUser('early', { position: 'CB' }),
    ]
    const team = makeTeam(['late', 'early'])
    const rsvps = [
      makeRSVP('late', new Date('2024-01-01T12:00:00Z')),
      makeRSVP('early', new Date('2024-01-01T10:00:00Z')),
    ]

    const result = assignPitchSlots(team, users, rsvps)
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    // Multiple CBs pair as LCB/RCB instead of stealing LB/RB
    expect(byId.early.assignedSlot).toBe('LCB')
    expect(byId.early.position).toEqual(POSITION_COORDINATES.LCB)
    expect(byId.late.assignedSlot).toBe('RCB')
    expect(byId.late.position).toEqual(POSITION_COORDINATES.RCB)
  })

  it('keeps LB/RB free when two CBs are present', () => {
    const users = [
      makeUser('cb1', { position: 'CB' }),
      makeUser('cb2', { position: 'CB' }),
      makeUser('lb', { position: 'LB' }),
      makeUser('rb', { position: 'RB' }),
    ]
    const team = makeTeam(['cb1', 'cb2', 'lb', 'rb'])
    const rsvps = users.map((u, i) =>
      makeRSVP(u.uid, new Date(`2024-01-01T10:0${i}:00Z`))
    )
    const result = assignPitchSlots(team, users, rsvps)
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    expect(byId.cb1.assignedSlot).toBe('LCB')
    expect(byId.cb2.assignedSlot).toBe('RCB')
    expect(byId.lb.assignedSlot).toBe('LB')
    expect(byId.rb.assignedSlot).toBe('RB')
    // Fullbacks stay wide of the CB pair
    expect(byId.lb.position.x).toBeLessThan(byId.cb1.position.x - 10)
    expect(byId.rb.position.x).toBeGreaterThan(byId.cb2.position.x + 10)
  })

  it('sorts players without RSVP after those with rsvpAt', () => {
    const users = [
      makeUser('noRsvp', { position: 'CM' }),
      makeUser('hasRsvp', { position: 'CM' }),
    ]
    const team = makeTeam(['noRsvp', 'hasRsvp'])
    const result = assignPitchSlots(team, users, [
      makeRSVP('hasRsvp', new Date('2024-01-01T10:00:00Z')),
    ])
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    expect(byId.hasRsvp.assignedSlot).toBe('CM')
    expect(byId.noRsvp.assignedSlot).toBe('CDM')
  })

  it('defaults missing position to CM', () => {
    const users = [makeUser('a', { position: null })]
    const team = makeTeam(['a'])
    const result = assignPitchSlots(team, users)

    expect(result[0].preferredPosition).toBe('CM')
    expect(result[0].assignedSlot).toBe('CM')
  })

  it('falls back to a horizontal nudge when preferred and adjacent slots are taken', () => {
    // Fill CM + all CM adjacency: CDM, CAM, LM, RM
    const ids = ['cm1', 'cdm', 'cam', 'lm', 'rm', 'cm2']
    const users = [
      makeUser('cm1', { position: 'CM' }),
      makeUser('cdm', { position: 'CDM' }),
      makeUser('cam', { position: 'CAM' }),
      makeUser('lm', { position: 'LM' }),
      makeUser('rm', { position: 'RM' }),
      makeUser('cm2', { position: 'CM' }),
    ]
    const team = makeTeam(ids)
    const rsvps = ids.map((id, i) =>
      makeRSVP(id, new Date(`2024-01-01T10:0${i}:00Z`))
    )

    const result = assignPitchSlots(team, users, rsvps)
    const cm2 = result.find(p => p.user.uid === 'cm2')
    expect(cm2).toBeDefined()
    expect(cm2!.preferredPosition).toBe('CM')
    // Nudge moves x away from the pure coordinate of the fallback slot
    expect(cm2!.position.x).not.toBe(
      POSITION_COORDINATES[cm2!.assignedSlot].x
    )
  })

  it('does not rewrite stored user.position on the returned user object', () => {
    const users = [
      makeUser('a', { position: 'ST' }),
      makeUser('b', { position: 'ST' }),
    ]
    const team = makeTeam(['a', 'b'])
    const result = assignPitchSlots(team, users, [
      makeRSVP('a', new Date('2024-01-01T10:00:00Z')),
      makeRSVP('b', new Date('2024-01-01T11:00:00Z')),
    ])

    expect(result.find(p => p.user.uid === 'a')!.user.position).toBe('ST')
    expect(result.find(p => p.user.uid === 'b')!.user.position).toBe('ST')
    expect(result.find(p => p.user.uid === 'b')!.assignedSlot).not.toBe('ST')
  })
})

describe('mapToHalfPitch', () => {
  it('compresses top-half and mirrors bottom-half Y', () => {
    const gk = POSITION_COORDINATES.GK
    const top = mapToHalfPitch(gk, 'top')
    const bottom = mapToHalfPitch(gk, 'bottom')

    expect(top.y).toBeLessThan(50)
    expect(bottom.y).toBeGreaterThan(50)
    expect(top.x).toBe(gk.x)
    expect(bottom.x).toBe(gk.x)
  })

  it('mirrors X for the top half so LB is team-left (screen-right)', () => {
    const lb = POSITION_COORDINATES.LB
    const rb = POSITION_COORDINATES.RB
    const topLb = mapToHalfPitch(lb, 'top')
    const topRb = mapToHalfPitch(rb, 'top')
    const bottomLb = mapToHalfPitch(lb, 'bottom')
    const bottomRb = mapToHalfPitch(rb, 'bottom')

    // Top team attacks down: LB on screen-right
    expect(topLb.x).toBeGreaterThan(topRb.x)
    expect(topLb.x).toBeCloseTo(100 - lb.x)
    // Bottom team attacks up: LB on screen-left
    expect(bottomLb.x).toBeLessThan(bottomRb.x)
    expect(bottomLb.x).toBe(lb.x)
  })
})

describe('getTeamPositionOccupancy', () => {
  it('counts preferred positions on a team', () => {
    const team = makeTeam(['a', 'b', 'c'])
    const users = [
      makeUser('a', { position: 'CB' }),
      makeUser('b', { position: 'CB' }),
      makeUser('c', { position: 'ST' }),
    ]
    expect(getTeamPositionOccupancy(team, users)).toEqual({ CB: 2, ST: 1 })
  })

  it('returns empty object when team is missing', () => {
    expect(getTeamPositionOccupancy(null, [])).toEqual({})
  })
})
