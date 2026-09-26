import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { initMock, boolVariationMock, waitForInitializationMock, closeMock } =
  vi.hoisted(() => ({
    initMock: vi.fn(),
    boolVariationMock: vi.fn(),
    waitForInitializationMock: vi.fn(),
    closeMock: vi.fn(),
  }))

vi.mock('@launchdarkly/node-server-sdk', () => ({
  init: initMock,
}))

import {
  evaluateFeatureFlag,
  resetServerLdClientForTests,
} from './evaluateFeatureFlag'

describe('evaluateFeatureFlag', () => {
  const originalSdkKey = process.env.LAUNCHDARKLY_SDK_KEY
  const originalLocalOverride = process.env.NEXT_PUBLIC_FF_CLUB_CREATION
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercelEnv = process.env.VERCEL_ENV

  beforeEach(() => {
    vi.clearAllMocks()
    resetServerLdClientForTests()
    delete process.env.LAUNCHDARKLY_SDK_KEY
    delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    delete process.env.VERCEL_ENV
    // Vitest default; keep overrides allowed unless a test forces production.
    vi.stubEnv('NODE_ENV', 'test')
    waitForInitializationMock.mockResolvedValue(undefined)
    boolVariationMock.mockResolvedValue(false)
    closeMock.mockReturnValue(undefined)
    initMock.mockReturnValue({
      waitForInitialization: waitForInitializationMock,
      boolVariation: boolVariationMock,
      close: closeMock,
    })
  })

  afterEach(() => {
    if (originalSdkKey === undefined) {
      delete process.env.LAUNCHDARKLY_SDK_KEY
    } else {
      process.env.LAUNCHDARKLY_SDK_KEY = originalSdkKey
    }
    if (originalLocalOverride === undefined) {
      delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    } else {
      process.env.NEXT_PUBLIC_FF_CLUB_CREATION = originalLocalOverride
    }
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV
    } else {
      process.env.VERCEL_ENV = originalVercelEnv
    }
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test')
    vi.unstubAllEnvs()
    resetServerLdClientForTests()
  })

  it('fails closed when LAUNCHDARKLY_SDK_KEY is missing', async () => {
    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(false)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('fails closed when SDK init fails, closes the client, then retries', async () => {
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'
    waitForInitializationMock.mockRejectedValueOnce(new Error('init failed'))
    waitForInitializationMock.mockResolvedValueOnce(undefined)
    boolVariationMock.mockResolvedValue(true)

    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(false)
    expect(boolVariationMock).not.toHaveBeenCalled()
    expect(closeMock).toHaveBeenCalledOnce()

    await expect(
      evaluateFeatureFlag('club-creation', { key: 'user-1' })
    ).resolves.toBe(true)
    expect(initMock).toHaveBeenCalledTimes(2)
    expect(boolVariationMock).toHaveBeenCalledOnce()
  })

  it('returns LD boolVariation when the client is ready', async () => {
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'
    boolVariationMock.mockResolvedValue(true)

    await expect(
      evaluateFeatureFlag('club-creation', {
        key: 'user-1',
        email: 'su@example.com',
      })
    ).resolves.toBe(true)

    expect(initMock).toHaveBeenCalledWith('sdk-test-key')
    expect(boolVariationMock).toHaveBeenCalledWith(
      'club-creation',
      expect.objectContaining({
        kind: 'user',
        key: 'user-1',
        email: 'su@example.com',
      }),
      false
    )
  })

  it('honors NEXT_PUBLIC_FF_CLUB_CREATION in non-production without calling LD', async () => {
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'

    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(true)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('ignores NEXT_PUBLIC_FF_CLUB_CREATION when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'
    boolVariationMock.mockResolvedValue(false)

    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(false)
    expect(initMock).toHaveBeenCalled()
    expect(boolVariationMock).toHaveBeenCalled()
  })
})
