import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import {
  computeEffectiveSkillScores,
  normalizeStoredSkillRatings,
  parseSkillAnswers,
} from '@/lib/skill/scoring'
import type {
  ClubSkillRankingDTO,
  EffectiveSkillScores,
  SkillAnswers,
  SkillAssessmentDTO,
  SkillRatingChanges,
} from '@/types/skill'

/**
 * Admin-SDK access to private skill data. Firestore rules deny all client
 * access to both collections; callers (API routes) enforce authorization.
 */
export const SKILL_ASSESSMENTS_COLLECTION = 'skillAssessments'
export const CLUB_SKILL_RANKINGS_COLLECTION = 'clubSkillRankings'

const GET_ALL_CHUNK = 100

function timestampToIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

function storedVersion(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0
}

/** The user's questionnaire, or null when missing or malformed. */
export async function getSkillAssessment(
  adminDb: Firestore,
  userId: string
): Promise<SkillAssessmentDTO | null> {
  const snap = await adminDb
    .collection(SKILL_ASSESSMENTS_COLLECTION)
    .doc(userId)
    .get()
  if (!snap.exists) return null
  const data = snap.data() ?? {}
  const answers = parseSkillAnswers(data.answers)
  if (!answers) return null
  return { answers, updatedAt: timestampToIso(data.updatedAt) }
}

/** Upsert the user's questionnaire. `answers` must already be validated. */
export async function saveSkillAssessment(
  adminDb: Firestore,
  userId: string,
  answers: SkillAnswers
): Promise<SkillAssessmentDTO> {
  const updatedAt = Timestamp.now()
  await adminDb
    .collection(SKILL_ASSESSMENTS_COLLECTION)
    .doc(userId)
    .set({ userId, answers, updatedAt })
  return { answers, updatedAt: timestampToIso(updatedAt) }
}

/**
 * Valid questionnaire answers for the given uids (chunked `getAll`).
 * Users without a doc, or with malformed answers, are absent from the map.
 */
export async function getSkillAnswersForUsers(
  adminDb: Firestore,
  userIds: Iterable<string>
): Promise<Map<string, SkillAnswers>> {
  const uniqueIds = Array.from(
    new Set(
      Array.from(userIds).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    )
  )
  const answersByUserId = new Map<string, SkillAnswers>()
  for (let i = 0; i < uniqueIds.length; i += GET_ALL_CHUNK) {
    const chunk = uniqueIds.slice(i, i + GET_ALL_CHUNK)
    const refs = chunk.map(id =>
      adminDb.collection(SKILL_ASSESSMENTS_COLLECTION).doc(id)
    )
    const snaps = await adminDb.getAll(...refs)
    for (const snap of snaps) {
      if (!snap.exists) continue
      const answers = parseSkillAnswers(snap.data()?.answers)
      if (answers) answersByUserId.set(snap.id, answers)
    }
  }
  return answersByUserId
}

/**
 * The club's admin ratings (normalized; version 0 when unsaved). Pass
 * `allowedUserIds` to drop uids that are no longer active members. Docs
 * saved by the earlier tier ranking have no `ratings` and read as unrated.
 */
export async function getClubSkillRanking(
  adminDb: Firestore,
  clubId: string,
  allowedUserIds?: ReadonlySet<string>
): Promise<ClubSkillRankingDTO> {
  const snap = await adminDb
    .collection(CLUB_SKILL_RANKINGS_COLLECTION)
    .doc(clubId)
    .get()
  const data = snap.exists ? (snap.data() ?? {}) : {}
  return {
    ratings: normalizeStoredSkillRatings(data.ratings, allowedUserIds),
    version: storedVersion(data.version),
  }
}

/**
 * Apply an admin's rating changes on top of the stored ratings, in a
 * transaction. Only the players in `changes` are touched, so two admins
 * saving at once both land; if both changed the same player, the later save
 * wins. A null change clears that player's rating. `changes` must already be
 * validated. Returns the merged ratings and the new version.
 */
export async function applyClubSkillRatingChanges(
  adminDb: Firestore,
  input: {
    clubId: string
    changes: SkillRatingChanges
    updatedBy: string
  }
): Promise<ClubSkillRankingDTO> {
  const ref = adminDb
    .collection(CLUB_SKILL_RANKINGS_COLLECTION)
    .doc(input.clubId)
  // The callback may retry; it only returns its outcome (no outer state).
  return adminDb.runTransaction(async (tx): Promise<ClubSkillRankingDTO> => {
    const snap = await tx.get(ref)
    const data = snap.exists ? (snap.data() ?? {}) : {}
    const ratings = normalizeStoredSkillRatings(data.ratings)
    for (const [uid, rating] of Object.entries(input.changes)) {
      if (rating === null) delete ratings[uid]
      else ratings[uid] = rating
    }
    const version = storedVersion(data.version) + 1
    tx.set(ref, {
      clubId: input.clubId,
      ratings,
      version,
      updatedBy: input.updatedBy,
      updatedAt: Timestamp.now(),
    })
    return { ratings, version }
  })
}

/**
 * Effective skill score (admin rating ?? default) for each uid in a club.
 * The questionnaire is not read while it is switched off.
 */
export async function getEffectiveSkillScoresForClub(
  adminDb: Firestore,
  clubId: string,
  userIds: readonly string[]
): Promise<EffectiveSkillScores> {
  const ranking = await getClubSkillRanking(adminDb, clubId)
  return computeEffectiveSkillScores(userIds, ranking.ratings)
}
