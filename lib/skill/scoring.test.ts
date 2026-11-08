import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SKILL,
  SKILL_QUESTIONNAIRE,
  assessmentScore,
  computeEffectiveSkillScores,
  isSkillRating,
  normalizeStoredSkillRatings,
  parseSkillAnswers,
  validateSkillRatingChanges,
} from './scoring'
import { SKILL_QUESTION_KEYS } from '@/types/skill'

const validAnswers = { firstTouch: 1, passing: 2, fitness: 3, gameSense: 2 }

describe('SKILL_QUESTIONNAIRE', () => {
  it('covers each question key once with answers 1, 2, 3', () => {
    expect(SKILL_QUESTIONNAIRE.map(q => q.key)).toEqual([
      ...SKILL_QUESTION_KEYS,
    ])
    for (const question of SKILL_QUESTIONNAIRE) {
      expect(question.options.map(o => o.value)).toEqual([1, 2, 3])
    }
  })

  it('uses the plan copy', () => {
    expect(SKILL_QUESTIONNAIRE[0].prompt).toBe(
      'A firm pass comes to you. Usually…'
    )
    expect(SKILL_QUESTIONNAIRE[3].options[2].label).toBe(
      "I've already checked where the space and my next pass are"
    )
  })
})

describe('parseSkillAnswers', () => {
  it('accepts exactly the four keys with values 1–3', () => {
    expect(parseSkillAnswers(validAnswers)).toEqual(validAnswers)
  })

  it('returns a copy, not the input object', () => {
    const input = { ...validAnswers }
    expect(parseSkillAnswers(input)).not.toBe(input)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'firstTouch'],
    ['an array', [1, 2, 3, 2]],
    ['a missing key', { firstTouch: 1, passing: 2, fitness: 3 }],
    ['an extra key', { ...validAnswers, extra: 1 }],
    ['zero', { ...validAnswers, passing: 0 }],
    ['four', { ...validAnswers, passing: 4 }],
    ['a fraction', { ...validAnswers, passing: 2.5 }],
    ['a numeric string', { ...validAnswers, passing: '2' }],
    ['NaN', { ...validAnswers, passing: Number.NaN }],
    ['null value', { ...validAnswers, passing: null }],
  ])('rejects %s', (_label, input) => {
    expect(parseSkillAnswers(input)).toBeNull()
  })
})

describe('assessmentScore', () => {
  it('maps the 1–3 mean onto 1–4', () => {
    const all = (v: 1 | 2 | 3) => ({
      firstTouch: v,
      passing: v,
      fitness: v,
      gameSense: v,
    })
    expect(assessmentScore(all(1))).toBe(1)
    expect(assessmentScore(all(2))).toBe(2.5)
    expect(assessmentScore(all(3))).toBe(4)
    // mean 2 → 2.5
    expect(
      assessmentScore({ firstTouch: 1, passing: 2, fitness: 3, gameSense: 2 })
    ).toBe(2.5)
    // mean 2.25 → 2.875
    expect(
      assessmentScore({ firstTouch: 3, passing: 2, fitness: 2, gameSense: 2 })
    ).toBeCloseTo(2.875)
  })
})

describe('isSkillRating', () => {
  it('accepts whole numbers 1–10 only', () => {
    expect([1, 5, 10].every(isSkillRating)).toBe(true)
    expect([0, 11, 5.5, '7', null, Number.NaN].some(isSkillRating)).toBe(false)
  })
})

describe('validateSkillRatingChanges', () => {
  const members = new Set(['a', 'b', 'c'])

  it('accepts ratings for members and null to clear', () => {
    expect(validateSkillRatingChanges({ a: 9, b: null }, members)).toEqual({
      ok: true,
      changes: { a: 9, b: null },
    })
  })

  it('lets a former member be cleared but not rated', () => {
    expect(validateSkillRatingChanges({ gone: null }, members).ok).toBe(true)
    expect(validateSkillRatingChanges({ gone: 4 }, members).ok).toBe(false)
  })

  it.each([
    ['null', null],
    ['an array', [5]],
    ['an empty object', {}],
    ['zero', { a: 0 }],
    ['eleven', { a: 11 }],
    ['a fraction', { a: 6.5 }],
    ['a numeric string', { a: '6' }],
  ])('rejects %s', (_label, input) => {
    expect(validateSkillRatingChanges(input, members).ok).toBe(false)
  })
})

describe('normalizeStoredSkillRatings', () => {
  it('drops invalid entries and, when given, non-members', () => {
    expect(
      normalizeStoredSkillRatings({ a: 7, b: 12, c: 'x', gone: 3 })
    ).toEqual({ a: 7, gone: 3 })
    expect(
      normalizeStoredSkillRatings({ a: 7, gone: 3 }, new Set(['a']))
    ).toEqual({ a: 7 })
  })

  it('reads a doc saved by the old tier ranking as unrated', () => {
    expect(normalizeStoredSkillRatings(undefined)).toEqual({})
  })
})

describe('computeEffectiveSkillScores', () => {
  it('uses the admin rating, else the 5.5 default', () => {
    const result = computeEffectiveSkillScores(['rated', 'none'], {
      rated: 8,
    })
    expect(result.scoreByUserId.get('rated')).toBe(8)
    expect(result.scoreByUserId.get('none')).toBe(DEFAULT_SKILL)
    expect(DEFAULT_SKILL).toBe(5.5)
    expect(result.unratedUserIds).toEqual(['none'])
  })

  it('treats everyone as unrated without ratings, counting each uid once', () => {
    const result = computeEffectiveSkillScores(['x', 'x', 'y'], null)
    expect(result.unratedUserIds).toEqual(['x', 'y'])
    expect(result.scoreByUserId.size).toBe(2)
  })
})
