'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  LDProvider,
  useFlags,
  useLDClient,
} from 'launchdarkly-react-client-sdk'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  getLocalFeatureFlagOverrides,
  type FeatureFlagKey,
} from '@/lib/flags/featureFlags'
import { anonymousContext, contextFromAuth } from '@/lib/flags/ldContext'
import { useAuth } from '@/lib/hooks/useAuth'

const CLIENT_SIDE_ID =
  process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID?.trim() ?? ''

function readTypedFlags(
  raw: Record<string, unknown>
): Partial<Record<FeatureFlagKey, boolean>> {
  const next: Partial<Record<FeatureFlagKey, boolean>> = {
    ...FEATURE_FLAG_DEFAULTS,
  }
  for (const key of FEATURE_FLAG_KEYS) {
    const value = raw[key]
    if (typeof value === 'boolean') {
      next[key] = value
    }
  }
  return next
}

function closedFlags(): Partial<Record<FeatureFlagKey, boolean>> {
  return {
    ...FEATURE_FLAG_DEFAULTS,
    ...getLocalFeatureFlagOverrides(),
  }
}

/**
 * Bridges LD `useFlags` into our typed context and re-identifies when auth changes.
 */
function LaunchDarklyBridge({ children }: { children: ReactNode }) {
  const flags = useFlags()
  const ldClient = useLDClient()
  const { user } = useAuth()
  const [typedFlags, setTypedFlags] = useState(closedFlags)

  useEffect(() => {
    setTypedFlags({
      ...readTypedFlags(flags as Record<string, unknown>),
      ...getLocalFeatureFlagOverrides(),
    })
  }, [flags])

  useEffect(() => {
    if (!ldClient) return
    let cancelled = false
    const ctx = user
      ? contextFromAuth(user.uid, user.email)
      : anonymousContext()

    void ldClient
      .identify(ctx)
      .then(raw => {
        if (cancelled) return
        setTypedFlags({
          ...readTypedFlags(raw as Record<string, unknown>),
          ...getLocalFeatureFlagOverrides(),
        })
      })
      .catch(() => {
        // Fail-closed: leave flags at defaults / last known values
      })

    return () => {
      cancelled = true
    }
  }, [ldClient, user])

  return (
    <FeatureFlagContext.Provider value={typedFlags}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

/**
 * App-wide LaunchDarkly provider. Nest under AuthProvider so context can use uid/email.
 * When the client ID is missing, children still render and all flags stay false.
 *
 * Waits for Firebase auth to finish loading before booting the LD client so we do
 * not evaluate flags as `anonymous` for a signed-in Google user.
 */
export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (!CLIENT_SIDE_ID) {
    return (
      <FeatureFlagContext.Provider value={closedFlags()}>
        {children}
      </FeatureFlagContext.Provider>
    )
  }

  // Auth still resolving: keep fail-closed defaults (do not boot LD as anonymous).
  if (loading) {
    return (
      <FeatureFlagContext.Provider value={closedFlags()}>
        {children}
      </FeatureFlagContext.Provider>
    )
  }

  const context = user
    ? contextFromAuth(user.uid, user.email)
    : anonymousContext()

  return (
    <LDProvider
      key={user?.uid ?? 'anonymous'}
      clientSideID={CLIENT_SIDE_ID}
      context={context}
      options={{
        // Do not block first paint; list view stays safe until flags arrive.
        bootstrap: 'localStorage',
        streaming: true,
      }}
      reactOptions={{
        // Keep dashboard keys as-is (e.g. pitch-lineup-view).
        useCamelCaseFlagKeys: false,
      }}
      timeout={5}
    >
      <LaunchDarklyBridge>{children}</LaunchDarklyBridge>
    </LDProvider>
  )
}
