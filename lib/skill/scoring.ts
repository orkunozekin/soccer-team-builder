import {
  type EffectiveSkillScores,
  SKILL_QUESTION_KEYS,
  SKILL_TIER_KEYS,
  type SkillAnswerValue,
  type SkillAnswers,
  type SkillQuestion,
  type SkillRankingTiers,
  type SkillTierKey,
} from '@/types/skill'

/** Score for players with neither a ranking nor a questionnaire. */
export const DEFAULT_SKILL = 2.5

/** Max offset added/subtracted by position within a tier (keeps tiers from overlapping). */
export const TIER_POSITION_SPREAD = 0.4

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

export const SKILL_TIER_LABELS: Record<SkillTierKey, string> = {
  top: 'Top',
  strong: 'Strong',
  average: 'Average',
  developing: 'Developing',
}

export const SKILL_TIER_VALUES: Record<SkillTierKey, number> = {
  top: 4,
  strong: 3,
  average: 2,
  developing: 1,
}

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

export type SkillTiersValidationResult =
  | { ok: true; tiers: SkillRankingTiers }
  | { ok: false; error: string }

/**
 * Validate untrusted ranking tiers for a save. Requires exactly the four tier
 * keys, each an array of uid strings; a uid may appear once across all tiers
 * and must be in `allowedUserIds` (e.g. the club's active members).
 */
export function validateSkillTiers(
  input: unknown,
  allowedUserIds: ReadonlySet<string>
): SkillTiersValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Tiers must be an object' }
  }
  const unknownKey = Object.keys(input).find(
    key => !(SKILL_TIER_KEYS as readonly string[]).includes(key)
  )
  if (unknownKey !== undefined) {
    return { ok: false, error: 'Unknown tier' }
  }

  const seen = new Set<string>()
  const tiers = emptySkillTiers()
  for (const tier of SKILL_TIER_KEYS) {
    const list = input[tier]
    if (!Array.isArray(list)) {
      return { ok: false, error: 'Each tier must be a list of players' }
    }
    for (const uid of list) {
      if (typeof uid !== 'string' || uid.length === 0) {
        return { ok: false, error: 'Invalid player id' }
      }
      if (seen.has(uid)) {
        return { ok: false, error: 'A player can only be ranked once' }
      }
      if (!allowedUserIds.has(uid)) {
        return { ok: false, error: 'Only active club members can be ranked' }
      }
      seen.add(uid)
      tiers[tier].push(uid)
    }
  }
  return { ok: true, tiers }
}

export function emptySkillTiers(): SkillRankingTiers {
  return { top: [], strong: [], average: [], developing: [] }
}

/**
 * Lenient normalizer for tiers read from storage. Missing or malformed tiers
 * become empty, non-string / empty ids are dropped, and a uid listed more than
 * once keeps only its first (strongest) placement. When `allowedUserIds` is
 * given, uids outside it (e.g. former members) are dropped.
 */
export function normalizeStoredSkillTiers(
  input: unknown,
  allowedUserIds?: ReadonlySet<string>
): SkillRankingTiers {
  const tiers = emptySkillTiers()
  if (!isPlainObject(input)) return tiers
  const seen = new Set<string>()
  for (const tier of SKILL_TIER_KEYS) {
    const list = input[tier]
    if (!Array.isArray(list)) continue
    for (const uid of list) {
      if (typeof uid !== 'string' || uid.length === 0) continue
      if (seen.has(uid)) continue
      if (allowedUserIds && !allowedUserIds.has(uid)) continue
      seen.add(uid)
      tiers[tier].push(uid)
    }
  }
  return tiers
}

/** Map questionnaire answers onto the 1–4 tier scale: 1 + (mean − 1) × 1.5. */
export function assessmentScore(answers: SkillAnswers): number {
  const sum = SKILL_QUESTION_KEYS.reduce((acc, key) => acc + answers[key], 0)
  const mean = sum / SKILL_QUESTION_KEYS.length
  return 1 + (mean - 1) * 1.5
}

/**
 * Score every ranked uid: tier value plus an in-tier offset that runs from
 * +0.4 (strongest) to −0.4 (weakest), so order matters without crossing tiers.
 * Expects normalized tiers (no duplicates); a repeated uid keeps its first score.
 */
export function rankingScores(tiers: SkillRankingTiers): Map<string, number> {
  const scores = new Map<string, number>()
  for (const tier of SKILL_TIER_KEYS) {
    const list = tiers[tier]
    const n = list.length
    list.forEach((uid, i) => {
      if (scores.has(uid)) return
      const offset =
        n > 1
          ? TIER_POSITION_SPREAD - (2 * TIER_POSITION_SPREAD * i) / (n - 1)
          : 0
      scores.set(uid, SKILL_TIER_VALUES[tier] + offset)
    })
  }
  return scores
}

/**
 * Effective score per uid: ranking ?? questionnaire ?? DEFAULT_SKILL.
 * `unratedUserIds` lists uids (in input order) that fell back to the default.
 */
export function computeEffectiveSkillScores(
  userIds: readonly string[],
  sources: {
    tiers?: SkillRankingTiers | null
    answersByUserId?: ReadonlyMap<string, SkillAnswers>
  }
): EffectiveSkillScores {
  const ranked = sources.tiers ? rankingScores(sources.tiers) : new Map()
  const scoreByUserId = new Map<string, number>()
  const unratedUserIds: string[] = []
  for (const uid of userIds) {
    if (scoreByUserId.has(uid)) continue
    const rankScore = ranked.get(uid)
    if (rankScore !== undefined) {
      scoreByUserId.set(uid, rankScore)
      continue
    }
    const answers = sources.answersByUserId?.get(uid)
    if (answers) {
      scoreByUserId.set(uid, assessmentScore(answers))
      continue
    }
    scoreByUserId.set(uid, DEFAULT_SKILL)
    unratedUserIds.push(uid)
  }
  return { scoreByUserId, unratedUserIds }
}
