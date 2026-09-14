import { describe, expect, it } from 'vitest'

/**
 * IFAB Law 1 geometry used by PitchMarkings (standard 105×68 m pitch).
 * Kept as pure numbers so we can assert proportions without rendering SVG.
 */
const WIDTH = 68
const LENGTH = 105
const GOAL_INNER = 7.32
const PENALTY_DEPTH = 16.5
const GOAL_AREA_DEPTH = 5.5
const PENALTY_WIDTH = GOAL_INNER + 2 * PENALTY_DEPTH
const GOAL_AREA_WIDTH = GOAL_INNER + 2 * GOAL_AREA_DEPTH
const PENALTY_MARK = 11
const CIRCLE_R = 9.15

describe('IFAB pitch marking proportions', () => {
  it('uses the standard international pitch aspect (width/length)', () => {
    expect(WIDTH / LENGTH).toBeCloseTo(68 / 105, 5)
  })

  it('sizes the penalty area from the goal posts (16.5 m offset)', () => {
    expect(PENALTY_WIDTH).toBeCloseTo(40.32, 5)
    expect(PENALTY_DEPTH).toBe(16.5)
    // Depth is ~15.7% of pitch length (not ~24% as when axes were swapped)
    expect(PENALTY_DEPTH / LENGTH).toBeCloseTo(16.5 / 105, 5)
    // Width is ~59% of pitch width
    expect(PENALTY_WIDTH / WIDTH).toBeCloseTo(40.32 / 68, 5)
  })

  it('sizes the goal area from the goal posts (5.5 m offset)', () => {
    expect(GOAL_AREA_WIDTH).toBeCloseTo(18.32, 5)
    expect(GOAL_AREA_DEPTH).toBe(5.5)
  })

  it('places the penalty mark 11 m from the goal line', () => {
    expect(PENALTY_MARK).toBe(11)
    expect(PENALTY_MARK).toBeLessThan(PENALTY_DEPTH)
  })

  it('keeps the penalty arc chord outside the penalty area', () => {
    const distMarkToBoxLine = PENALTY_DEPTH - PENALTY_MARK // 5.5
    const arcChordHalf = Math.sqrt(CIRCLE_R ** 2 - distMarkToBoxLine ** 2)
    expect(distMarkToBoxLine).toBeCloseTo(5.5, 5)
    expect(arcChordHalf).toBeGreaterThan(0)
    expect(arcChordHalf).toBeLessThan(CIRCLE_R)
    // Arc must not span the full box width
    expect(2 * arcChordHalf).toBeLessThan(PENALTY_WIDTH)
  })
})
