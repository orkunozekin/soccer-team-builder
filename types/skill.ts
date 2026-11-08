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

/** A club admin's rating of a player: an integer from 1 (weakest) to 10. */
export type SkillRating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** A club's ratings keyed by uid; unrated players are absent. */
export type SkillRatings = Record<string, SkillRating>

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
  /** Uids with no admin rating (scored as the default). */
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

/** `strength` on a skill-balanced rebalance response (admins only). */
export interface RebalanceStrengthSummary extends TeamStrengthSummary {
  /** Players placed on teams (the denominator for `unratedCount`). */
  playerCount: number
}

/** A player's stored questionnaire, as returned by the API. */
export interface SkillAssessmentDTO {
  answers: SkillAnswers
  /** ISO timestamp, or null when the stored doc has none. */
  updatedAt: string | null
}

/** A club's admin ratings, as returned by the API (`version` is 0 when unsaved). */
export interface ClubSkillRankingDTO {
  ratings: SkillRatings
  version: number
}

/** An active club member as listed on the admin rating board. */
export interface SkillRankingMemberDTO {
  userId: string
  displayName: string
  position: string | null
}
