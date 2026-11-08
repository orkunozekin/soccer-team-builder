import type {
  SkillRating,
  SkillRatingChanges,
  SkillRatings,
} from '@/types/skill'

/** Set `userId`'s rating, or remove it (unrated) when `rating` is null. */
export function setSkillRating(
  ratings: SkillRatings,
  userId: string,
  rating: SkillRating | null
): SkillRatings {
  if (rating === null) {
    if (!(userId in ratings)) return ratings
    const next = { ...ratings }
    delete next[userId]
    return next
  }
  if (ratings[userId] === rating) return ratings
  return { ...ratings, [userId]: rating }
}

/** Drop ratings for uids that aren't in `memberIds` (e.g. a member who left). */
export function keepRatedMembers(
  ratings: SkillRatings,
  memberIds: readonly string[]
): SkillRatings {
  const allowed = new Set(memberIds)
  const next: SkillRatings = {}
  for (const [uid, rating] of Object.entries(ratings)) {
    if (allowed.has(uid)) next[uid] = rating
  }
  return next
}

/** Same players with the same ratings. */
export function skillRatingsEqual(a: SkillRatings, b: SkillRatings): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every(uid => a[uid] === b[uid])
}

/**
 * Only what changed from `saved` to `draft`: new or changed ratings, and null
 * for a rating that was cleared.
 */
export function diffSkillRatings(
  saved: SkillRatings,
  draft: SkillRatings
): SkillRatingChanges {
  const changes: SkillRatingChanges = {}
  for (const [uid, rating] of Object.entries(draft)) {
    if (saved[uid] !== rating) changes[uid] = rating
  }
  for (const uid of Object.keys(saved)) {
    if (!(uid in draft)) changes[uid] = null
  }
  return changes
}
