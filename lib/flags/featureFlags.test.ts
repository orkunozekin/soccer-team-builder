import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  getLocalFeatureFlagOverrides,
} from './featureFlags'

describe('getLocalFeatureFlagOverrides', () => {
  const originalClub = process.env.NEXT_PUBLIC_FF_CLUB_CREATION
  const originalPitch = process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
  const originalLightTheme = process.env.NEXT_PUBLIC_FF_LIGHT_THEME
  const originalSkill = process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercelEnv = process.env.VERCEL_ENV

  afterEach(() => {
    if (originalClub === undefined)
      delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    else process.env.NEXT_PUBLIC_FF_CLUB_CREATION = originalClub
    if (originalPitch === undefined) {
      delete process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
    } else {
      process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW = originalPitch
    }
    if (originalLightTheme === undefined) {
      delete process.env.NEXT_PUBLIC_FF_LIGHT_THEME
    } else {
      process.env.NEXT_PUBLIC_FF_LIGHT_THEME = originalLightTheme
    }
    if (originalSkill === undefined) {
      delete process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS
    } else {
      process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS = originalSkill
    }
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercelEnv
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test')
    vi.unstubAllEnvs()
  })

  it('returns overrides in non-production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW = 'true'
    process.env.NEXT_PUBLIC_FF_LIGHT_THEME = 'true'
    process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS = 'true'

    expect(getLocalFeatureFlagOverrides()).toEqual({
      'club-creation': true,
      'pitch-lineup-view': true,
      'light-theme': true,
      'skill-balanced-teams': true,
    })
  })

  it('returns empty when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.NEXT_PUBLIC_FF_LIGHT_THEME = 'true'
    process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS = 'true'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })

  it('returns empty when VERCEL_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.NEXT_PUBLIC_FF_LIGHT_THEME = 'true'
    process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS = 'true'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })

  it('omits light-theme unless its override is exactly true', () => {
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.VERCEL_ENV
    delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    delete process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
    process.env.NEXT_PUBLIC_FF_LIGHT_THEME = '1'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })

  it('omits skill-balanced-teams unless its override is exactly true', () => {
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.VERCEL_ENV
    delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    delete process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
    delete process.env.NEXT_PUBLIC_FF_LIGHT_THEME
    process.env.NEXT_PUBLIC_FF_SKILL_BALANCED_TEAMS = 'TRUE'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })
})

describe('FEATURE_FLAG_DEFAULTS', () => {
  it('keeps skill-balanced-teams fail-closed', () => {
    expect(FEATURE_FLAG_KEYS).toContain('skill-balanced-teams')
    expect(FEATURE_FLAG_DEFAULTS['skill-balanced-teams']).toBe(false)
  })
})
