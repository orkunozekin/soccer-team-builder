import { describe, expect, it } from 'vitest'
import { FORMATIONS, getFormationById } from '@/lib/constants/formations'
import {
  assignPlayersToFormation,
  minCostAssignment,
  positionDistance,
} from '@/lib/utils/assignFormationPositions'

describe('positionDistance', () => {
  it('is zero for the same position', () => {
    expect(positionDistance('ST', 'ST')).toBe(0)
  })

  it('treats GK as closer to CB than to ST', () => {
    expect(positionDistance('GK', 'CB')).toBeLessThan(positionDistance('GK', 'ST'))
  })
})

describe('minCostAssignment', () => {
  it('assigns each row a unique column for square costs', () => {
    const costs = [
      [0, 9, 9],
      [9, 0, 9],
      [9, 9, 0],
    ]
    expect(minCostAssignment(costs)).toEqual([0, 1, 2])
  })

  it('leaves unused columns when fewer rows than columns', () => {
    const costs = [
      [5, 0, 5],
      [0, 5, 5],
    ]
    const assign = minCostAssignment(costs)
    expect(assign).toHaveLength(2)
    expect(new Set(assign).size).toBe(2)
    expect(assign).toContain(0)
    expect(assign).toContain(1)
  })

  it('leaves some rows unmatched when more rows than columns', () => {
    const costs = [
      [0, 9],
      [9, 0],
      [1, 1],
    ]
    const assign = minCostAssignment(costs)
    expect(assign.filter(s => s >= 0)).toHaveLength(2)
    expect(assign[0]).toBe(0)
    expect(assign[1]).toBe(1)
    expect(assign[2]).toBe(-1)
  })
})

describe('assignPlayersToFormation', () => {
  it('maps a classic XI into 4-4-2 slots near their roles', () => {
    const formation = getFormationById('4-4-2')!
    const players = [
      { userId: 'gk', position: 'GK' },
      { userId: 'lb', position: 'LB' },
      { userId: 'cb1', position: 'CB' },
      { userId: 'cb2', position: 'CB' },
      { userId: 'rb', position: 'RB' },
      { userId: 'lm', position: 'LM' },
      { userId: 'cm1', position: 'CM' },
      { userId: 'cm2', position: 'CM' },
      { userId: 'rm', position: 'RM' },
      { userId: 'st1', position: 'ST' },
      { userId: 'st2', position: 'ST' },
    ]

    const result = assignPlayersToFormation(players, formation.slots)
    expect(result).toHaveLength(11)

    const byId = new Map(result.map(r => [r.userId, r.toPosition]))
    expect(byId.get('gk')).toBe('GK')
    expect(byId.get('lb')).toBe('LB')
    expect(byId.get('rb')).toBe('RB')
    expect(byId.get('st1')).toBe('ST')
    expect(byId.get('st2')).toBe('ST')

    const counts = new Map<string, number>()
    for (const r of result) {
      counts.set(r.toPosition, (counts.get(r.toPosition) ?? 0) + 1)
    }
    expect(counts.get('CB')).toBe(2)
    expect(counts.get('CM')).toBe(2)
    expect(counts.get('ST')).toBe(2)
  })

  it('moves wingers into midfield when switching 4-3-3 to 4-4-2', () => {
    const fourFourTwo = getFormationById('4-4-2')!
    const players = [
      { userId: 'gk', position: 'GK' },
      { userId: 'lb', position: 'LB' },
      { userId: 'cb1', position: 'CB' },
      { userId: 'cb2', position: 'CB' },
      { userId: 'rb', position: 'RB' },
      { userId: 'cm1', position: 'CM' },
      { userId: 'cm2', position: 'CM' },
      { userId: 'cm3', position: 'CM' },
      { userId: 'lw', position: 'LW' },
      { userId: 'st', position: 'ST' },
      { userId: 'rw', position: 'RW' },
    ]

    const result = assignPlayersToFormation(players, fourFourTwo.slots)
    const byId = new Map(result.map(r => [r.userId, r.toPosition]))

    expect(byId.get('gk')).toBe('GK')
    // Wingers should land on wide midfield slots in 4-4-2
    expect(byId.get('lw')).toBe('LM')
    expect(byId.get('rw')).toBe('RM')
    expect(byId.get('st')).toBe('ST')
  })

  it('assigns overflow players to the closest formation slot code', () => {
    const formation = getFormationById('4-4-2')!
    const players = [
      { userId: 'gk', position: 'GK' },
      { userId: 'lb', position: 'LB' },
      { userId: 'cb1', position: 'CB' },
      { userId: 'cb2', position: 'CB' },
      { userId: 'rb', position: 'RB' },
      { userId: 'lm', position: 'LM' },
      { userId: 'cm1', position: 'CM' },
      { userId: 'cm2', position: 'CM' },
      { userId: 'rm', position: 'RM' },
      { userId: 'st1', position: 'ST' },
      { userId: 'st2', position: 'ST' },
      { userId: 'extra', position: 'CAM' },
    ]

    const result = assignPlayersToFormation(players, formation.slots)
    expect(result).toHaveLength(12)
    const extra = result.find(r => r.userId === 'extra')
    expect(extra).toBeTruthy()
    // CAM is closest to CM among 4-4-2 slots
    expect(extra!.toPosition).toBe('CM')
  })

  it('handles short-handed teams without requiring all slots', () => {
    const formation = getFormationById('4-3-3')!
    const players = [
      { userId: 'gk', position: 'GK' },
      { userId: 'cb', position: 'CB' },
      { userId: 'st', position: 'ST' },
    ]
    const result = assignPlayersToFormation(players, formation.slots)
    expect(result).toHaveLength(3)
    expect(result.find(r => r.userId === 'gk')?.toPosition).toBe('GK')
    expect(result.find(r => r.userId === 'st')?.toPosition).toBe('ST')
  })

  it('covers every configured formation id', () => {
    expect(FORMATIONS.length).toBeGreaterThanOrEqual(8)
    for (const f of FORMATIONS) {
      expect(f.slots).toContain('GK')
      expect(f.slots.length).toBe(11)
    }
  })
})
