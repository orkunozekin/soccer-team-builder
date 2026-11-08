import { describe, expect, it } from 'vitest'
import {
  diffSkillRatings,
  keepRatedMembers,
  setSkillRating,
  skillRatingsEqual,
} from './ratingEdits'

describe('setSkillRating', () => {
  it('sets, changes and clears a rating without mutating the input', () => {
    const start = { a: 5 as const }
    const rated = setSkillRating(start, 'b', 8)
    expect(rated).toEqual({ a: 5, b: 8 })
    expect(setSkillRating(rated, 'b', 3)).toEqual({ a: 5, b: 3 })
    expect(setSkillRating(rated, 'a', null)).toEqual({ b: 8 })
    expect(start).toEqual({ a: 5 })
  })

  it('returns the same object when nothing changes', () => {
    const start = { a: 5 as const }
    expect(setSkillRating(start, 'a', 5)).toBe(start)
    expect(setSkillRating(start, 'zz', null)).toBe(start)
  })
})

describe('keepRatedMembers', () => {
  it('drops ratings for uids that are no longer members', () => {
    expect(keepRatedMembers({ a: 7, gone: 2 }, ['a', 'b'])).toEqual({ a: 7 })
  })
})

describe('skillRatingsEqual', () => {
  it('compares players and values', () => {
    expect(skillRatingsEqual({ a: 7, b: 3 }, { b: 3, a: 7 })).toBe(true)
    expect(skillRatingsEqual({ a: 7 }, { a: 8 })).toBe(false)
    expect(skillRatingsEqual({ a: 7 }, { a: 7, b: 3 })).toBe(false)
  })
})

describe('diffSkillRatings', () => {
  it('lists new, changed and cleared ratings only', () => {
    expect(
      diffSkillRatings({ a: 5, b: 7, c: 2 }, { a: 5, b: 9, d: 4 })
    ).toEqual({ b: 9, c: null, d: 4 })
    expect(diffSkillRatings({ a: 5 }, { a: 5 })).toEqual({})
  })
})
