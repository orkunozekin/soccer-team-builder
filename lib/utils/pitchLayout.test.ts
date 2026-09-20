import { describe, expect, it } from 'vitest'
import {
  assignPitchSlots,
  getTeamPositionOccupancy,
  layoutTeamOnPitch,
  mapToHalfPitch,
  PITCH_EDGE_MARGIN_X,
  POSITION_COORDINATES,
  separatePlayers,
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

    // Two CMs pair horizontally; earliest RSVP gets LCM
    expect(byId.hasRsvp.assignedSlot).toBe('LCM')
    expect(byId.noRsvp.assignedSlot).toBe('RCM')
    expect(byId.hasRsvp.position.y).toBe(byId.noRsvp.position.y)
  })

  it('keeps multiple CMs on the same horizontal band', () => {
    const users = [
      makeUser('cm1', { position: 'CM' }),
      makeUser('cm2', { position: 'CM' }),
      makeUser('lm', { position: 'LM' }),
      makeUser('rm', { position: 'RM' }),
    ]
    const team = makeTeam(['cm1', 'cm2', 'lm', 'rm'])
    const rsvps = users.map((u, i) =>
      makeRSVP(u.uid, new Date(`2024-01-01T10:0${i}:00Z`))
    )
    const result = assignPitchSlots(team, users, rsvps)
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    expect(byId.cm1.assignedSlot).toBe('LCM')
    expect(byId.cm2.assignedSlot).toBe('RCM')
    expect(byId.cm1.position.y).toBe(POSITION_COORDINATES.CM.y)
    expect(byId.cm2.position.y).toBe(POSITION_COORDINATES.CM.y)
    expect(byId.lm.position.x).toBe(POSITION_COORDINATES.LB.x)
    expect(byId.rm.position.x).toBe(POSITION_COORDINATES.RB.x)
  })

  it('defaults missing position to CM', () => {
    const users = [makeUser('a', { position: null })]
    const team = makeTeam(['a'])
    const result = assignPitchSlots(team, users)

    expect(result[0].preferredPosition).toBe('CM')
    expect(result[0].assignedSlot).toBe('CM')
  })

  it('still places players when users array is missing profiles', () => {
    const team = makeTeam(['a', 'b'])
    const rsvps = [
      makeRSVP('a', new Date('2024-01-01T10:00:00Z'), { position: 'ST' }),
      makeRSVP('b', new Date('2024-01-01T10:01:00Z'), { position: 'GK' }),
    ]
    const result = assignPitchSlots(team, [], rsvps)

    expect(result).toHaveLength(2)
    expect(result.map(p => p.user.uid).sort()).toEqual(['a', 'b'])
    expect(result.find(p => p.user.uid === 'a')?.preferredPosition).toBe('ST')
    expect(result.find(p => p.user.uid === 'b')?.preferredPosition).toBe('GK')
  })

  it('falls back to a horizontal nudge when preferred and adjacent slots are taken', () => {
    // Three CMs + fill LCM/RCM band leftovers via CDM/CAM so the third nudges
    const ids = ['cm1', 'cm2', 'cdm', 'cam', 'cm3']
    const users = [
      makeUser('cm1', { position: 'CM' }),
      makeUser('cm2', { position: 'CM' }),
      makeUser('cdm', { position: 'CDM' }),
      makeUser('cam', { position: 'CAM' }),
      makeUser('cm3', { position: 'CM' }),
    ]
    const team = makeTeam(ids)
    const rsvps = ids.map((id, i) =>
      makeRSVP(id, new Date(`2024-01-01T10:0${i}:00Z`))
    )

    const result = assignPitchSlots(team, users, rsvps)
    const cm3 = result.find(p => p.user.uid === 'cm3')
    expect(cm3).toBeDefined()
    expect(cm3!.preferredPosition).toBe('CM')
    // Nudge moves x away from the pure coordinate of the fallback slot
    expect(cm3!.position.x).not.toBe(
      POSITION_COORDINATES[cm3!.assignedSlot].x
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

  it('places duplicate STs side-by-side on the same band', () => {
    const users = [
      makeUser('early', { position: 'ST' }),
      makeUser('late', { position: 'ST' }),
    ]
    const team = makeTeam(['early', 'late'])
    const result = assignPitchSlots(team, users, [
      makeRSVP('early', new Date('2024-01-01T10:00:00Z')),
      makeRSVP('late', new Date('2024-01-01T11:00:00Z')),
    ])
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    expect(byId.early.assignedSlot).toBe('LST')
    expect(byId.late.assignedSlot).toBe('RST')
    expect(byId.early.position.y).toBe(byId.late.position.y)
    expect(byId.early.position.x).toBeLessThan(byId.late.position.x)
  })

  it('places duplicate CAMs side-by-side on the same band', () => {
    const users = [
      makeUser('a', { position: 'CAM' }),
      makeUser('b', { position: 'CAM' }),
    ]
    const team = makeTeam(['a', 'b'])
    const result = assignPitchSlots(team, users, [
      makeRSVP('a', new Date('2024-01-01T10:00:00Z')),
      makeRSVP('b', new Date('2024-01-01T11:00:00Z')),
    ])
    const byId = Object.fromEntries(result.map(p => [p.user.uid, p]))

    expect(byId.a.assignedSlot).toBe('LCAM')
    expect(byId.b.assignedSlot).toBe('RCAM')
    expect(byId.a.position.y).toBe(byId.b.position.y)
    expect(byId.a.position.x).toBeLessThan(byId.b.position.x)
  })

  it('keeps wing slots inset from the touchline', () => {
    expect(POSITION_COORDINATES.LB.x).toBeGreaterThanOrEqual(
      PITCH_EDGE_MARGIN_X
    )
    expect(POSITION_COORDINATES.LWB.x).toBeGreaterThanOrEqual(
      PITCH_EDGE_MARGIN_X
    )
    expect(POSITION_COORDINATES.RB.x).toBeLessThanOrEqual(
      100 - PITCH_EDGE_MARGIN_X
    )
    expect(POSITION_COORDINATES.RWB.x).toBeLessThanOrEqual(
      100 - PITCH_EDGE_MARGIN_X
    )
  })
})

describe('separatePlayers', () => {
  it('pushes overlapping markers apart', () => {
    const users = [
      makeUser('a', { position: 'LB' }),
      makeUser('b', { position: 'LB' }),
    ]
    const stacked = [
      {
        user: users[0],
        position: { x: 50, y: 50 },
        assignedSlot: 'LB',
        preferredPosition: 'LB',
      },
      {
        user: users[1],
        position: { x: 50, y: 50 },
        assignedSlot: 'LWB',
        preferredPosition: 'LB',
      },
    ]

    const result = separatePlayers(stacked, { minSepX: 14, minSepY: 10 })
    const dx = Math.abs(result[0].position.x - result[1].position.x)
    const dy = Math.abs(result[0].position.y - result[1].position.y)
    expect(dx >= 10 || dy >= 8).toBe(true)
  })

  it('clamps markers inside pitch margins', () => {
    const users = [makeUser('a'), makeUser('b')]
    const result = separatePlayers(
      [
        {
          user: users[0],
          position: { x: 2, y: 2 },
          assignedSlot: 'LB',
          preferredPosition: 'LB',
        },
        {
          user: users[1],
          position: { x: 3, y: 3 },
          assignedSlot: 'LWB',
          preferredPosition: 'LWB',
        },
      ],
      { minSepX: 14, minSepY: 10 }
    )

    for (const p of result) {
      expect(p.position.x).toBeGreaterThanOrEqual(PITCH_EDGE_MARGIN_X)
      expect(p.position.x).toBeLessThanOrEqual(100 - PITCH_EDGE_MARGIN_X)
      expect(p.position.y).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('layoutTeamOnPitch', () => {
  it('separates a crowded left flank on the half pitch', () => {
    const ids = ['lb1', 'lb2', 'lwb1', 'lwb2']
    const users = [
      makeUser('lb1', { position: 'LB' }),
      makeUser('lb2', { position: 'LB' }),
      makeUser('lwb1', { position: 'LWB' }),
      makeUser('lwb2', { position: 'LWB' }),
    ]
    const team = makeTeam(ids)
    const rsvps = ids.map((id, i) =>
      makeRSVP(id, new Date(`2024-01-01T10:0${i}:00Z`))
    )

    const result = layoutTeamOnPitch(team, users, rsvps, 'top')
    expect(result).toHaveLength(4)

    for (let i = 0; i < result.length; i++) {
      expect(result[i].position.x).toBeGreaterThanOrEqual(PITCH_EDGE_MARGIN_X)
      expect(result[i].position.x).toBeLessThanOrEqual(
        100 - PITCH_EDGE_MARGIN_X
      )
      for (let j = i + 1; j < result.length; j++) {
        const dx = Math.abs(result[i].position.x - result[j].position.x)
        const dy = Math.abs(result[i].position.y - result[j].position.y)
        // Elliptical separation used on half pitch (minSepX=14, minSepY=9)
        const norm = (dx / 14) ** 2 + (dy / 9) ** 2
        expect(norm).toBeGreaterThanOrEqual(0.85)
      }
    }
  })

  it('keeps a sparse single-team roster in the bottom half only', () => {
    const users = [
      makeUser('gk', { position: 'GK' }),
      makeUser('st', { position: 'ST' }),
    ]
    const team = makeTeam(['gk', 'st'])
    const rsvps = [
      makeRSVP('gk', new Date('2024-01-01T10:00:00Z')),
      makeRSVP('st', new Date('2024-01-01T10:01:00Z')),
    ]

    const full = layoutTeamOnPitch(team, users, rsvps)
    const half = layoutTeamOnPitch(team, users, rsvps, 'bottom')

    // Full pitch spreads GK near the top and ST near the bottom.
    expect(Math.min(...full.map(p => p.position.y))).toBeLessThan(50)
    expect(Math.max(...full.map(p => p.position.y))).toBeGreaterThan(50)

    // Half-pitch layout (extra / single team) stays on its own side.
    for (const p of half) {
      expect(p.position.y).toBeGreaterThan(50)
    }
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
