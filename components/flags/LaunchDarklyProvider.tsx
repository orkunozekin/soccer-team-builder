'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LDProvider, useLDClient } from 'launchdarkly-react-client-sdk'
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
 * Syncs typed flags from the LD client only (never from an empty useFlags()
 * snapshot that would wipe a successful identify() back to defaults).
 */
function LaunchDarklyBridge({ children }: { children: ReactNode }) {
  const ldClient = useLDClient()
  const { user } = useAuth()
  const [typedFlags, setTypedFlags] = useState(closedFlags)

  const applyFlags = useCallback((raw: Record<string, unknown>) => {
    setTypedFlags({
      ...readTypedFlags(raw),
      ...getLocalFeatureFlagOverrides(),
    })
  }, [])

  useEffect(() => {
    if (!ldClient) return
    let cancelled = false

    const syncFromClient = () => {
      if (cancelled) return
      applyFlags(ldClient.allFlags() as Record<string, unknown>)
    }

    void ldClient
      .waitForInitialization(5)
      .then(syncFromClient)
      .catch(() => {
        // Fail-closed: leave defaults
      })

    ldClient.on('change', syncFromClient)

    return () => {
      cancelled = true
      ldClient.off('change', syncFromClient)
    }
  }, [ldClient, applyFlags])

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
        applyFlags(raw as Record<string, unknown>)
      })
      .catch(() => {
        // Fail-closed: leave flags at defaults / last known values
      })

    return () => {
      cancelled = true
    }
  }, [ldClient, user, applyFlags])

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
        // Avoid localStorage bootstrap: a cached `false` from before targeting
        // was configured can stick and race with identify().
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
