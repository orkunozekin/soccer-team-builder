import { describe, expect, it } from 'vitest'
import {
  type SkillBalanceTeam,
  balanceTeamsBySkill,
  summarizeTeamStrength,
} from './balanceTeamsBySkill'
import { DEFAULT_SKILL } from '@/lib/skill/scoring'

type Team = SkillBalanceTeam & { id: string }

function team(teamNumber: number, playerIds: string[]): Team {
  return { id: `t${teamNumber}`, teamNumber, playerIds }
}

function scores(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries))
}

function total(t: SkillBalanceTeam, s: Map<string, number>): number {
  return t.playerIds.reduce(
    (sum, uid) => sum + (s.get(uid) ?? DEFAULT_SKILL),
    0
  )
}

function gap(a: SkillBalanceTeam, b: SkillBalanceTeam, s: Map<string, number>) {
  return Math.abs(total(a, s) - total(b, s))
}

/** Brute-force best gap for a pair with the same per-team movable slot counts. */
function optimalGap(
  a: SkillBalanceTeam,
  b: SkillBalanceTeam,
  s: Map<string, number>,
  locked: Set<string>
): number {
  const score = (uid: string) => s.get(uid) ?? DEFAULT_SKILL
  const pool = [...a.playerIds, ...b.playerIds].filter(u => !locked.has(u))
  const slotsA = a.playerIds.filter(u => !locked.has(u)).length
  const lockedA = a.playerIds.filter(u => locked.has(u))
  const lockedB = b.playerIds.filter(u => locked.has(u))
  const base =
    lockedA.reduce((x, u) => x + score(u), 0) -
    lockedB.reduce((x, u) => x + score(u), 0)
  const poolTotal = pool.reduce((x, u) => x + score(u), 0)
  let best = Infinity
  for (let mask = 0; mask < 1 << pool.length; mask++) {
    let bits = 0
    let sumA = 0
    for (let i = 0; i < pool.length; i++) {
      if (mask & (1 << i)) {
        bits++
        sumA += score(pool[i])
      }
    }
    if (bits !== slotsA) continue
    best = Math.min(best, Math.abs(base + sumA - (poolTotal - sumA)))
  }
  return best
}

describe('balanceTeamsBySkill', () => {
  it('finds the optimal split on small cases', () => {
    const cases: Array<{
      s: Record<string, number>
      a: string[]
      b: string[]
    }> = [
      {
        s: { p1: 4, p2: 4, p3: 1, p4: 1 },
        a: ['p1', 'p2'],
        b: ['p3', 'p4'],
      },
      {
        s: { p1: 4.4, p2: 3.6, p3: 3, p4: 2.5, p5: 2, p6: 1.2 },
        a: ['p1', 'p2', 'p3'],
        b: ['p4', 'p5', 'p6'],
      },
      {
        s: { a: 4, b: 3.5, c: 3, d: 2.5, e: 2, f: 1.5, g: 1, h: 1 },
        a: ['a', 'b', 'c', 'd'],
        b: ['e', 'f', 'g', 'h'],
      },
      {
        s: { a: 3.8, b: 3.1, c: 2.6, d: 2.2, e: 1.4 },
        a: ['a', 'b', 'c'],
        b: ['d', 'e'],
      },
    ]
    for (const c of cases) {
      const s = scores(c.s)
      const input = [team(1, c.a), team(2, c.b)]
      const [a, b] = balanceTeamsBySkill(input, s, new Set())
      expect(gap(a, b, s)).toBeCloseTo(
        optimalGap(input[0], input[1], s, new Set())
      )
      expect(a.playerIds).toHaveLength(c.a.length)
      expect(b.playerIds).toHaveLength(c.b.length)
      expect([...a.playerIds, ...b.playerIds].sort()).toEqual(
        [...c.a, ...c.b].sort()
      )
    }
  })

  it('splits two stars apart', () => {
    const s = scores({ s1: 4, s2: 4, w1: 1, w2: 1 })
    const [a, b] = balanceTeamsBySkill(
      [team(1, ['s1', 's2']), team(2, ['w1', 'w2'])],
      s,
      new Set()
    )
    expect(total(a, s)).toBe(5)
    expect(total(b, s)).toBe(5)
  })

  it('never moves locked players and keeps their slot index', () => {
    const s = scores({ gk1: 1, gk2: 1, pin: 4, x: 4, y: 3, z: 1, w: 1 })
    const locked = new Set(['gk1', 'gk2', 'pin'])
    const input = [
      team(1, ['gk1', 'pin', 'x', 'y']),
      team(2, ['z', 'gk2', 'w']),
    ]
    const [a, b] = balanceTeamsBySkill(input, s, locked)
    expect(a.playerIds[0]).toBe('gk1')
    expect(a.playerIds[1]).toBe('pin')
    expect(b.playerIds[1]).toBe('gk2')
    expect(a.playerIds).toHaveLength(4)
    expect(b.playerIds).toHaveLength(3)
    expect(gap(a, b, s)).toBeCloseTo(optimalGap(input[0], input[1], s, locked))
  })

  it('leaves a pair alone when everyone is locked', () => {
    const s = scores({ a: 4, b: 1 })
    const input = [team(1, ['a']), team(2, ['b'])]
    const out = balanceTeamsBySkill(input, s, new Set(['a', 'b']))
    expect(out).toEqual(input)
  })

  it('leaves an unpaired last team untouched', () => {
    const s = scores({ a: 4, b: 4, c: 1, d: 1, e: 4, f: 1 })
    const input = [
      team(1, ['a', 'b']),
      team(2, ['c', 'd']),
      team(3, ['e', 'f']),
    ]
    const out = balanceTeamsBySkill(input, s, new Set())
    expect(out[2].playerIds).toEqual(['e', 'f'])
    expect(gap(out[0], out[1], s)).toBe(0)
  })

  it('pairs by teamNumber and keeps players inside their pair', () => {
    const s = scores({ a: 4, b: 4, c: 1, d: 1, e: 4, f: 4, g: 1, h: 1 })
    const input = [
      team(4, ['g', 'h']),
      team(1, ['a', 'b']),
      team(3, ['e', 'f']),
      team(2, ['c', 'd']),
    ]
    const out = balanceTeamsBySkill(input, s, new Set())
    expect(out.map(t => t.teamNumber)).toEqual([4, 1, 3, 2])
    const pair12 = [...out[1].playerIds, ...out[3].playerIds].sort()
    const pair34 = [...out[2].playerIds, ...out[0].playerIds].sort()
    expect(pair12).toEqual(['a', 'b', 'c', 'd'])
    expect(pair34).toEqual(['e', 'f', 'g', 'h'])
    expect(gap(out[1], out[3], s)).toBe(0)
    expect(gap(out[2], out[0], s)).toBe(0)
  })

  it('is deterministic, including ties', () => {
    const s = scores({ a: 2, b: 2, c: 2, d: 2, e: 3, f: 1 })
    const input = [team(1, ['a', 'b', 'e']), team(2, ['c', 'd', 'f'])]
    const first = balanceTeamsBySkill(input, s, new Set())
    for (let i = 0; i < 5; i++) {
      expect(balanceTeamsBySkill(input, s, new Set())).toEqual(first)
    }
  })

  it('does not mutate its inputs and preserves extra fields', () => {
    const s = scores({ a: 4, b: 4, c: 1, d: 1 })
    const input = [team(1, ['a', 'b']), team(2, ['c', 'd'])]
    const snapshot = JSON.parse(JSON.stringify(input))
    const out = balanceTeamsBySkill(input, s, new Set())
    expect(input).toEqual(snapshot)
    expect(out[0]).not.toBe(input[0])
    expect(out[0].playerIds).not.toBe(input[0].playerIds)
    expect(out[0].id).toBe('t1')
  })

  it('treats unknown or non-finite scores as the default', () => {
    const s = new Map([
      ['a', 4],
      ['b', Number.NaN],
    ])
    const input = [team(1, ['a', 'b']), team(2, ['c', 'd'])]
    const [a, b] = balanceTeamsBySkill(input, s, new Set())
    expect(a.playerIds).toHaveLength(2)
    expect(b.playerIds).toHaveLength(2)
    expect(a.playerIds.includes('a') !== b.playerIds.includes('a')).toBe(true)
  })

  it('handles empty and single-team input', () => {
    expect(balanceTeamsBySkill([], new Map(), new Set())).toEqual([])
    const solo = [team(1, ['a'])]
    expect(balanceTeamsBySkill(solo, new Map(), new Set())).toEqual(solo)
  })
})

describe('summarizeTeamStrength', () => {
  it('reports total, average and size per team sorted by teamNumber', () => {
    const s = scores({ a: 4.4, b: 2.5, c: 1.2 })
    const summary = summarizeTeamStrength(
      [team(2, ['c']), team(1, ['a', 'b']), team(3, [])],
      s,
      ['b', 'not-playing']
    )
    expect(summary).toEqual({
      teams: [
        { teamNumber: 1, total: 6.9, average: 3.45, size: 2 },
        { teamNumber: 2, total: 1.2, average: 1.2, size: 1 },
        { teamNumber: 3, total: 0, average: 0, size: 0 },
      ],
      unratedCount: 1,
    })
  })
})
