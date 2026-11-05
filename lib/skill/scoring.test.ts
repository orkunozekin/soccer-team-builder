import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SKILL,
  SKILL_QUESTIONNAIRE,
  SKILL_TIER_LABELS,
  SKILL_TIER_VALUES,
  assessmentScore,
  computeEffectiveSkillScores,
  normalizeStoredSkillTiers,
  parseSkillAnswers,
  rankingScores,
  validateSkillTiers,
} from './scoring'
import { SKILL_QUESTION_KEYS, SKILL_TIER_KEYS } from '@/types/skill'

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

describe('tier constants', () => {
  it('labels and values every tier', () => {
    expect(SKILL_TIER_KEYS.map(t => SKILL_TIER_LABELS[t])).toEqual([
      'Top',
      'Strong',
      'Average',
      'Developing',
    ])
    expect(SKILL_TIER_KEYS.map(t => SKILL_TIER_VALUES[t])).toEqual([4, 3, 2, 1])
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

describe('validateSkillTiers', () => {
  const allowed = new Set(['a', 'b', 'c', 'd'])
  const empty = { top: [], strong: [], average: [], developing: [] }

  it('accepts valid tiers and returns a copy', () => {
    const input = { ...empty, top: ['a', 'b'], developing: ['c'] }
    const result = validateSkillTiers(input, allowed)
    expect(result).toEqual({
      ok: true,
      tiers: { top: ['a', 'b'], strong: [], average: [], developing: ['c'] },
    })
    if (result.ok) expect(result.tiers.top).not.toBe(input.top)
  })

  it('accepts an empty ranking', () => {
    expect(validateSkillTiers(empty, allowed)).toEqual({
      ok: true,
      tiers: empty,
    })
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a missing tier', { top: [], strong: [], average: [] }],
    ['an unknown tier', { ...empty, elite: [] }],
    ['a non-array tier', { ...empty, top: 'a' }],
    ['a non-string id', { ...empty, top: [1] }],
    ['an empty id', { ...empty, top: [''] }],
    ['a duplicate within a tier', { ...empty, top: ['a', 'a'] }],
    ['a duplicate across tiers', { ...empty, top: ['a'], average: ['a'] }],
    ['a uid outside the allowed set', { ...empty, strong: ['zed'] }],
  ])('rejects %s', (_label, input) => {
    const result = validateSkillTiers(input, allowed)
    expect(result.ok).toBe(false)
  })
})

describe('normalizeStoredSkillTiers', () => {
  it('returns empty tiers for non-objects', () => {
    const empty = { top: [], strong: [], average: [], developing: [] }
    expect(normalizeStoredSkillTiers(null)).toEqual(empty)
    expect(normalizeStoredSkillTiers('x')).toEqual(empty)
    expect(normalizeStoredSkillTiers([])).toEqual(empty)
  })

  it('drops bad entries, keeps the first placement and ignores unknown tiers', () => {
    expect(
      normalizeStoredSkillTiers({
        top: ['a', 1, '', 'b'],
        strong: 'not-a-list',
        average: ['b', 'c', 'c'],
        elite: ['z'],
      })
    ).toEqual({ top: ['a', 'b'], strong: [], average: ['c'], developing: [] })
  })

  it('filters to allowed uids when given', () => {
    expect(
      normalizeStoredSkillTiers(
        { top: ['a', 'gone'], developing: ['b'] },
        new Set(['a', 'b'])
      )
    ).toEqual({ top: ['a'], strong: [], average: [], developing: ['b'] })
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

describe('rankingScores', () => {
  it('uses the tier value alone for a single player', () => {
    const scores = rankingScores({
      top: ['a'],
      strong: [],
      average: [],
      developing: [],
    })
    expect(scores.get('a')).toBe(4)
  })

  it('spreads players from +0.4 to −0.4 within a tier', () => {
    const scores = rankingScores({
      top: [],
      strong: ['a', 'b', 'c'],
      average: ['d', 'e'],
      developing: [],
    })
    expect(scores.get('a')).toBeCloseTo(3.4)
    expect(scores.get('b')).toBeCloseTo(3)
    expect(scores.get('c')).toBeCloseTo(2.6)
    expect(scores.get('d')).toBeCloseTo(2.4)
    expect(scores.get('e')).toBeCloseTo(1.6)
  })

  it('never lets the weakest of a tier fall to the next tier’s best', () => {
    const scores = rankingScores({
      top: ['a', 'b'],
      strong: ['c', 'd'],
      average: [],
      developing: [],
    })
    expect(scores.get('b')!).toBeGreaterThan(scores.get('c')!)
  })
})

describe('computeEffectiveSkillScores', () => {
  it('prefers ranking, then questionnaire, then the default', () => {
    const result = computeEffectiveSkillScores(['ranked', 'quiz', 'none'], {
      tiers: {
        top: ['ranked', 'quiz'],
        strong: [],
        average: [],
        developing: [],
      },
      answersByUserId: new Map([
        [
          'quiz',
          { firstTouch: 1, passing: 1, fitness: 1, gameSense: 1 } as const,
        ],
      ]),
    })
    expect(result.scoreByUserId.get('ranked')).toBeCloseTo(4.4)
    expect(result.scoreByUserId.get('quiz')).toBeCloseTo(3.6)
    expect(result.scoreByUserId.get('none')).toBe(DEFAULT_SKILL)
    expect(result.unratedUserIds).toEqual(['none'])
  })

  it('uses the questionnaire when the player is unranked', () => {
    const result = computeEffectiveSkillScores(['quiz'], {
      tiers: null,
      answersByUserId: new Map([
        [
          'quiz',
          { firstTouch: 3, passing: 3, fitness: 3, gameSense: 3 } as const,
        ],
      ]),
    })
    expect(result.scoreByUserId.get('quiz')).toBe(4)
    expect(result.unratedUserIds).toEqual([])
  })

  it('counts each unrated uid once', () => {
    const result = computeEffectiveSkillScores(['x', 'x', 'y'], {})
    expect(result.unratedUserIds).toEqual(['x', 'y'])
    expect(result.scoreByUserId.size).toBe(2)
  })
})
