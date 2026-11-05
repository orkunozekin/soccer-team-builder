/** Questionnaire question keys (see docs/features/player-skill-rating-feature-plan.md). */
export const SKILL_QUESTION_KEYS = [
  'firstTouch',
  'passing',
  'fitness',
  'gameSense',
] as const

export type SkillQuestionKey = (typeof SKILL_QUESTION_KEYS)[number]

/** Each questionnaire answer scores 1 (lowest) to 3 (highest). */
export type SkillAnswerValue = 1 | 2 | 3

export type SkillAnswers = Record<SkillQuestionKey, SkillAnswerValue>

/** Ranking tiers, strongest first. */
export const SKILL_TIER_KEYS = [
  'top',
  'strong',
  'average',
  'developing',
] as const

export type SkillTierKey = (typeof SKILL_TIER_KEYS)[number]

/** Club ranking: each tier lists uids ordered strongest first. */
export type SkillRankingTiers = Record<SkillTierKey, string[]>

export interface SkillQuestionOption {
  value: SkillAnswerValue
  label: string
}

export interface SkillQuestion {
  key: SkillQuestionKey
  prompt: string
  options: readonly [
    SkillQuestionOption,
    SkillQuestionOption,
    SkillQuestionOption,
  ]
}

export interface EffectiveSkillScores {
  scoreByUserId: Map<string, number>
  /** Uids that had neither a ranking nor a questionnaire (scored as default). */
  unratedUserIds: string[]
}

export interface TeamStrength {
  teamNumber: number
  total: number
  average: number
  size: number
}

export interface TeamStrengthSummary {
  teams: TeamStrength[]
  unratedCount: number
}

/** A player's stored questionnaire, as returned by the API. */
export interface SkillAssessmentDTO {
  answers: SkillAnswers
  /** ISO timestamp, or null when the stored doc has none. */
  updatedAt: string | null
}

/** A club's ranking, as returned by the API (`version` is 0 when unsaved). */
export interface ClubSkillRankingDTO {
  tiers: SkillRankingTiers
  version: number
}

/** An active club member as listed on the admin ranking board. */
export interface SkillRankingMemberDTO {
  userId: string
  displayName: string
  position: string | null
  /** Questionnaire score on the 1–4 scale, or null without a questionnaire. */
  assessmentScore: number | null
}
