import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { initMock, boolVariationMock, waitForInitializationMock } = vi.hoisted(
  () => ({
    initMock: vi.fn(),
    boolVariationMock: vi.fn(),
    waitForInitializationMock: vi.fn(),
  })
)

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

  beforeEach(() => {
    vi.clearAllMocks()
    resetServerLdClientForTests()
    delete process.env.LAUNCHDARKLY_SDK_KEY
    delete process.env.NEXT_PUBLIC_FF_CLUB_CREATION
    waitForInitializationMock.mockResolvedValue(undefined)
    boolVariationMock.mockResolvedValue(false)
    initMock.mockReturnValue({
      waitForInitialization: waitForInitializationMock,
      boolVariation: boolVariationMock,
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
    resetServerLdClientForTests()
  })

  it('fails closed when LAUNCHDARKLY_SDK_KEY is missing', async () => {
    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(false)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('fails closed when SDK init fails', async () => {
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'
    waitForInitializationMock.mockRejectedValue(new Error('init failed'))

    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(false)
    expect(boolVariationMock).not.toHaveBeenCalled()
  })

  it('returns LD boolVariation when the client is ready', async () => {
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'
    boolVariationMock.mockResolvedValue(true)

    await expect(
      evaluateFeatureFlag('club-creation', { key: 'user-1' })
    ).resolves.toBe(true)

    expect(initMock).toHaveBeenCalledWith('sdk-test-key')
    expect(boolVariationMock).toHaveBeenCalledWith(
      'club-creation',
      expect.objectContaining({ kind: 'user', key: 'user-1' }),
      false
    )
  })

  it('honors NEXT_PUBLIC_FF_CLUB_CREATION without calling LD', async () => {
    process.env.NEXT_PUBLIC_FF_CLUB_CREATION = 'true'
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-key'

    await expect(evaluateFeatureFlag('club-creation')).resolves.toBe(true)
    expect(initMock).not.toHaveBeenCalled()
  })
})
