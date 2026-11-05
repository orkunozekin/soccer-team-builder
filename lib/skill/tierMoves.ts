import { emptySkillTiers } from '@/lib/skill/scoring'
import {
  SKILL_TIER_KEYS,
  type SkillRankingTiers,
  type SkillTierKey,
} from '@/types/skill'

/** A ranking board group: one of the four tiers, or not ranked yet. */
export type SkillBoardGroup = SkillTierKey | 'unranked'

export type TierMoveDirection = 'up' | 'down'

/** The tier `userId` is ranked in, or `'unranked'`. */
export function findSkillTier(
  tiers: SkillRankingTiers,
  userId: string
): SkillBoardGroup {
  return (
    SKILL_TIER_KEYS.find(tier => tiers[tier].includes(userId)) ?? 'unranked'
  )
}

/**
 * Move `userId` into `target`, appended as its weakest player. `'unranked'`
 * removes them from the ranking. Moving into the tier they are already in
 * leaves the ranking unchanged.
 */
export function moveToSkillTier(
  tiers: SkillRankingTiers,
  userId: string,
  target: SkillBoardGroup
): SkillRankingTiers {
  if (findSkillTier(tiers, userId) === target) return tiers
  const next = emptySkillTiers()
  for (const tier of SKILL_TIER_KEYS) {
    next[tier] = tiers[tier].filter(uid => uid !== userId)
  }
  if (target !== 'unranked') next[target].push(userId)
  return next
}

/**
 * Swap `userId` with its neighbour inside its tier (`'up'` = stronger).
 * Unranked players and moves past either end leave the ranking unchanged.
 */
export function moveWithinSkillTier(
  tiers: SkillRankingTiers,
  userId: string,
  direction: TierMoveDirection
): SkillRankingTiers {
  const tier = findSkillTier(tiers, userId)
  if (tier === 'unranked') return tiers
  const list = tiers[tier]
  const index = list.indexOf(userId)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= list.length) return tiers
  const reordered = [...list]
  reordered[index] = list[swapWith]
  reordered[swapWith] = userId
  return { ...tiers, [tier]: reordered }
}

/** Members in no tier, in the order `memberIds` lists them. */
export function unrankedSkillMemberIds(
  tiers: SkillRankingTiers,
  memberIds: readonly string[]
): string[] {
  const ranked = new Set(SKILL_TIER_KEYS.flatMap(tier => tiers[tier]))
  return memberIds.filter(uid => !ranked.has(uid))
}

/** Drop uids that aren't in `memberIds` (e.g. a member who just left). */
export function keepSkillTierMembers(
  tiers: SkillRankingTiers,
  memberIds: readonly string[]
): SkillRankingTiers {
  const allowed = new Set(memberIds)
  const next = emptySkillTiers()
  for (const tier of SKILL_TIER_KEYS) {
    next[tier] = tiers[tier].filter(uid => allowed.has(uid))
  }
  return next
}

/** Same players in the same tiers and order. */
export function skillTiersEqual(
  a: SkillRankingTiers,
  b: SkillRankingTiers
): boolean {
  return SKILL_TIER_KEYS.every(
    tier =>
      a[tier].length === b[tier].length &&
      a[tier].every((uid, i) => uid === b[tier][i])
  )
}
