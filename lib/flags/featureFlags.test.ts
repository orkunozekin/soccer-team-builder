import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocalFeatureFlagOverrides } from './featureFlags'

describe('getLocalFeatureFlagOverrides', () => {
  const originalClub = process.env.NEXT_PUBLIC_FF_CLUB_CREATION
  const originalPitch = process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercelEnv = process.env.VERCEL_ENV

  afterEach(() => {
    if (originalClub === undefined) delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    else process.env.NEXT_PUBLIC_FF_CLUB_CREATION = originalClub
    if (originalPitch === undefined) {
      delete process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW
    } else {
      process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW = originalPitch
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

    expect(getLocalFeatureFlagOverrides()).toEqual({
      'club-creation': true,
      'pitch-lineup-view': true,
    })
  })

  it('returns empty when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })

  it('returns empty when VERCEL_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'

    expect(getLocalFeatureFlagOverrides()).toEqual({})
  })
})
