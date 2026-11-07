import {
  type EffectiveSkillScores,
  SKILL_QUESTION_KEYS,
  type SkillAnswerValue,
  type SkillAnswers,
  type SkillQuestion,
  type SkillRating,
  type SkillRatings,
} from '@/types/skill'

export const MIN_SKILL_RATING = 1
export const MAX_SKILL_RATING = 10

/** Score for players a club admin hasn't rated: the middle of the 1–10 scale. */
export const DEFAULT_SKILL = 5.5

export const SKILL_QUESTIONNAIRE: readonly SkillQuestion[] = [
  {
    key: 'firstTouch',
    prompt: 'A firm pass comes to you. Usually…',
    options: [
      { value: 1, label: 'It often gets away from me' },
      { value: 2, label: 'I control it, but need a second touch' },
      {
        value: 3,
        label: "It's under control and I'm already turning or passing",
      },
    ],
  },
  {
    key: 'passing',
    prompt: 'Passing to a teammate about 20 yards (18 m) away on the ground…',
    options: [
      { value: 1, label: 'I often miss the target' },
      { value: 2, label: 'I usually reach them' },
      { value: 3, label: 'I hit them at the right pace, either foot' },
    ],
  },
  {
    key: 'fitness',
    prompt: 'Over a 60-minute game…',
    options: [
      { value: 1, label: 'I need regular breaks' },
      { value: 2, label: 'I keep going with a few breaks' },
      { value: 3, label: "I'm running hard until the end" },
    ],
  },
  {
    key: 'gameSense',
    prompt: 'Before the ball reaches you…',
    options: [
      { value: 1, label: 'I decide what to do once I have it' },
      { value: 2, label: 'I sometimes know my next pass' },
      {
        value: 3,
        label: "I've already checked where the space and my next pass are",
      },
    ],
  },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAnswerValue(value: unknown): value is SkillAnswerValue {
  return value === 1 || value === 2 || value === 3
}

/**
 * Parse untrusted questionnaire answers. Requires exactly the four question
 * keys, each an integer 1–3. Returns null for anything else.
 */
export function parseSkillAnswers(input: unknown): SkillAnswers | null {
  if (!isPlainObject(input)) return null
  const keys = Object.keys(input)
  if (keys.length !== SKILL_QUESTION_KEYS.length) return null
  const answers: Partial<SkillAnswers> = {}
  for (const key of SKILL_QUESTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return null
    const value = input[key]
    if (!isAnswerValue(value)) return null
    answers[key] = value
  }
  return answers as SkillAnswers
}

export function isSkillRating(value: unknown): value is SkillRating {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SKILL_RATING &&
    value <= MAX_SKILL_RATING
  )
}

export type SkillRatingsValidationResult =
  | { ok: true; ratings: SkillRatings }
  | { ok: false; error: string }

/**
 * Validate untrusted ratings for a save: an object of uid → integer 1–10.
 * Every uid must be in `allowedUserIds` (the club's active members). Players
 * left out are unrated.
 */
export function validateSkillRatings(
  input: unknown,
  allowedUserIds: ReadonlySet<string>
): SkillRatingsValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Ratings must be an object' }
  }
  const ratings: SkillRatings = {}
  for (const [uid, value] of Object.entries(input)) {
    if (!uid) return { ok: false, error: 'Invalid player id' }
    if (!isSkillRating(value)) {
      return { ok: false, error: 'Ratings must be whole numbers from 1 to 10' }
    }
    if (!allowedUserIds.has(uid)) {
      return { ok: false, error: 'Only active club members can be rated' }
    }
    ratings[uid] = value
  }
  return { ok: true, ratings }
}

/**
 * Lenient normalizer for ratings read from storage: entries that aren't an
 * integer 1–10 are dropped, and when `allowedUserIds` is given, so are uids
 * outside it (e.g. former members).
 */
export function normalizeStoredSkillRatings(
  input: unknown,
  allowedUserIds?: ReadonlySet<string>
): SkillRatings {
  const ratings: SkillRatings = {}
  if (!isPlainObject(input)) return ratings
  for (const [uid, value] of Object.entries(input)) {
    if (!uid || !isSkillRating(value)) continue
    if (allowedUserIds && !allowedUserIds.has(uid)) continue
    ratings[uid] = value
  }
  return ratings
}

/** Questionnaire score on a 1–4 scale: 1 + (mean − 1) × 1.5 (questionnaire is off for now). */
export function assessmentScore(answers: SkillAnswers): number {
  const sum = SKILL_QUESTION_KEYS.reduce((acc, key) => acc + answers[key], 0)
  const mean = sum / SKILL_QUESTION_KEYS.length
  return 1 + (mean - 1) * 1.5
}

/**
 * Effective score per uid: the club admin's rating, or DEFAULT_SKILL when the
 * player isn't rated. `unratedUserIds` lists (in input order) who fell back.
 * The questionnaire is not used for balancing while it is switched off.
 */
export function computeEffectiveSkillScores(
  userIds: readonly string[],
  ratings: SkillRatings | null | undefined
): EffectiveSkillScores {
  const scoreByUserId = new Map<string, number>()
  const unratedUserIds: string[] = []
  for (const uid of userIds) {
    if (scoreByUserId.has(uid)) continue
    const rating = ratings?.[uid]
    if (rating !== undefined) {
      scoreByUserId.set(uid, rating)
      continue
    }
    scoreByUserId.set(uid, DEFAULT_SKILL)
    unratedUserIds.push(uid)
  }
  return { scoreByUserId, unratedUserIds }
}
