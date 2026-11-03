import { describe, expect, it } from 'vitest'
import { describeRosterFill, getRosterFill } from './rosterFill'

describe('getRosterFill', () => {
  it('targets two full teams for small headcounts', () => {
    expect(getRosterFill(18)).toEqual({
      confirmed: 18,
      teams: 2,
      capacity: 22,
      remaining: 4,
    })
  })

  it('expands to another team once two are full', () => {
    expect(getRosterFill(23)).toMatchObject({ teams: 3, remaining: 10 })
  })

  it('treats an exact multiple as full', () => {
    expect(getRosterFill(22)).toMatchObject({ teams: 2, remaining: 0 })
  })

  it('clamps invalid counts to zero', () => {
    expect(getRosterFill(-3)).toMatchObject({ confirmed: 0, remaining: 22 })
  })

  it('honours a custom team size', () => {
    expect(getRosterFill(9, 7)).toMatchObject({ teams: 2, capacity: 14 })
  })
})

describe('describeRosterFill', () => {
  it('pluralises open spots', () => {
    expect(describeRosterFill(getRosterFill(18))).toBe(
      '4 spots to fill 2 teams'
    )
    expect(describeRosterFill(getRosterFill(21))).toBe('1 spot to fill 2 teams')
  })

  it('reports full teams', () => {
    expect(describeRosterFill(getRosterFill(33))).toBe('3 full teams')
  })
})
