import { describe, expect, it } from 'vitest'
import {
  findSkillTier,
  keepSkillTierMembers,
  moveToSkillTier,
  moveWithinSkillTier,
  skillTiersEqual,
  unrankedSkillMemberIds,
} from './tierMoves'
import type { SkillRankingTiers } from '@/types/skill'

function tiers(partial: Partial<SkillRankingTiers> = {}): SkillRankingTiers {
  return { top: [], strong: [], average: [], developing: [], ...partial }
}

describe('findSkillTier', () => {
  it('returns the tier a player is in, or unranked', () => {
    const t = tiers({ strong: ['a'], developing: ['b'] })
    expect(findSkillTier(t, 'a')).toBe('strong')
    expect(findSkillTier(t, 'b')).toBe('developing')
    expect(findSkillTier(t, 'c')).toBe('unranked')
  })
})

describe('moveToSkillTier', () => {
  it('appends the player to the end of the target tier', () => {
    const t = tiers({ top: ['a', 'b'], average: ['c'] })
    expect(moveToSkillTier(t, 'a', 'average')).toEqual(
      tiers({ top: ['b'], average: ['c', 'a'] })
    )
  })

  it('ranks an unranked player at the end of the target tier', () => {
    const t = tiers({ top: ['a'] })
    expect(moveToSkillTier(t, 'z', 'top')).toEqual(tiers({ top: ['a', 'z'] }))
  })

  it('removes the player from the ranking when moved to unranked', () => {
    const t = tiers({ top: ['a', 'b'] })
    expect(moveToSkillTier(t, 'a', 'unranked')).toEqual(tiers({ top: ['b'] }))
  })

  it('leaves the ranking alone when the tier does not change', () => {
    const t = tiers({ top: ['a', 'b'] })
    expect(moveToSkillTier(t, 'a', 'top')).toBe(t)
    expect(moveToSkillTier(t, 'z', 'unranked')).toBe(t)
  })

  it('does not mutate the input', () => {
    const t = tiers({ top: ['a'], strong: ['b'] })
    moveToSkillTier(t, 'a', 'strong')
    expect(t).toEqual(tiers({ top: ['a'], strong: ['b'] }))
  })
})

describe('moveWithinSkillTier', () => {
  it('swaps with the stronger neighbour on up and the weaker on down', () => {
    const t = tiers({ strong: ['a', 'b', 'c'] })
    expect(moveWithinSkillTier(t, 'b', 'up').strong).toEqual(['b', 'a', 'c'])
    expect(moveWithinSkillTier(t, 'b', 'down').strong).toEqual(['a', 'c', 'b'])
    expect(t.strong).toEqual(['a', 'b', 'c'])
  })

  it('does nothing past either end or for unranked players', () => {
    const t = tiers({ strong: ['a', 'b'] })
    expect(moveWithinSkillTier(t, 'a', 'up')).toBe(t)
    expect(moveWithinSkillTier(t, 'b', 'down')).toBe(t)
    expect(moveWithinSkillTier(t, 'z', 'up')).toBe(t)
  })
})

describe('unrankedSkillMemberIds', () => {
  it('lists members in no tier, in member order', () => {
    const t = tiers({ top: ['b'], developing: ['d'] })
    expect(unrankedSkillMemberIds(t, ['a', 'b', 'c', 'd'])).toEqual(['a', 'c'])
  })
})

describe('keepSkillTierMembers', () => {
  it('drops ranked uids that are not members', () => {
    const t = tiers({ top: ['a', 'gone'], average: ['b'] })
    expect(keepSkillTierMembers(t, ['a', 'b'])).toEqual(
      tiers({ top: ['a'], average: ['b'] })
    )
  })
})

describe('skillTiersEqual', () => {
  it('compares tiers and order', () => {
    const t = tiers({ top: ['a', 'b'] })
    expect(skillTiersEqual(t, tiers({ top: ['a', 'b'] }))).toBe(true)
    expect(skillTiersEqual(t, tiers({ top: ['b', 'a'] }))).toBe(false)
    expect(skillTiersEqual(t, tiers({ top: ['a'], strong: ['b'] }))).toBe(false)
  })
})
