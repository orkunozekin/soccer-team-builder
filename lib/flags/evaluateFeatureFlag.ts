import * as LaunchDarkly from '@launchdarkly/node-server-sdk'
import {
  FEATURE_FLAG_DEFAULTS,
  getLocalFeatureFlagOverrides,
  type FeatureFlagKey,
} from '@/lib/flags/featureFlags'

type LdClient = LaunchDarkly.LDClient

let clientPromise: Promise<LdClient | null> | null = null

function getSdkKey(): string {
  return process.env.LAUNCHDARKLY_SDK_KEY?.trim() ?? ''
}

/**
 * Lazily init a shared server LD client. Returns null when the SDK key is
 * missing or initialization fails (fail-closed). Failed init is not cached
 * so a later request can retry once LaunchDarkly recovers.
 */
function getServerLdClient(): Promise<LdClient | null> {
  if (clientPromise) return clientPromise

  const sdkKey = getSdkKey()
  if (!sdkKey) {
    // Missing key is stable for the process lifetime; cache the closed result.
    clientPromise = Promise.resolve(null)
    return clientPromise
  }

  const attempt: { promise: Promise<LdClient | null> | null } = {
    promise: null,
  }
  attempt.promise = (async (): Promise<LdClient | null> => {
    let client: LdClient | null = null
    try {
      client = LaunchDarkly.init(sdkKey)
      await client.waitForInitialization({ timeout: 3 }) // seconds
      return client
    } catch (err) {
      console.error('LaunchDarkly server SDK init failed:', err)
      // Stop timers/connections from the failed client before allowing retry.
      try {
        client?.close()
      } catch (closeErr) {
        console.error('LaunchDarkly client close failed:', closeErr)
      }
      // Allow the next caller to retry init after a transient failure.
      if (clientPromise === attempt.promise) {
        clientPromise = null
      }
      return null
    }
  })()

  clientPromise = attempt.promise
  return attempt.promise
}

/** Reset cached client (tests only). */
export function resetServerLdClientForTests(): void {
  clientPromise = null
}

export type FeatureFlagContext = {
  key: string
  email?: string | null
  anonymous?: boolean
}

/**
 * Server-side boolean flag evaluation. Fail-closed:
 * local override → LD variation → typed default (false for gated features).
 * Missing SDK key, init failure, or evaluation errors return the default.
 */
export async function evaluateFeatureFlag(
  key: FeatureFlagKey,
  context?: FeatureFlagContext
): Promise<boolean> {
  const local = getLocalFeatureFlagOverrides()
  if (typeof local[key] === 'boolean') {
    return local[key] as boolean
  }

  const fallback = FEATURE_FLAG_DEFAULTS[key]

  try {
    const client = await getServerLdClient()
    if (!client) return fallback

    const ldContext: LaunchDarkly.LDContext = {
      kind: 'user',
      key: context?.key ?? 'anonymous',
      email: context?.email ?? undefined,
      anonymous: context?.anonymous ?? !context?.key,
    }

    const value = await client.boolVariation(key, ldContext, fallback)
    return typeof value === 'boolean' ? value : fallback
  } catch (err) {
    console.error(`LaunchDarkly evaluateFeatureFlag(${key}) failed:`, err)
    return fallback
  }
}
