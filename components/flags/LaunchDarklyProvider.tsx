'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  LDProvider,
  useFlags,
  useLDClient,
} from 'launchdarkly-react-client-sdk'
import type { LDContext } from 'launchdarkly-js-client-sdk'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  getLocalFeatureFlagOverrides,
  type FeatureFlagKey,
} from '@/lib/flags/featureFlags'
import { useAuth } from '@/lib/hooks/useAuth'

const CLIENT_SIDE_ID =
  process.env.NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID?.trim() ?? ''

function anonymousContext(): LDContext {
  return {
    kind: 'user',
    key: 'anonymous',
    anonymous: true,
  }
}

function contextFromAuth(uid: string, email: string | null): LDContext {
  return {
    kind: 'user',
    key: uid,
    email: email ?? undefined,
  }
}

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

/**
 * Bridges LD `useFlags` into our typed context and identifies the user when auth resolves.
 */
function LaunchDarklyBridge({ children }: { children: ReactNode }) {
  const flags = useFlags()
  const ldClient = useLDClient()
  const { user } = useAuth()
  const [typedFlags, setTypedFlags] = useState(() =>
    readTypedFlags(flags as Record<string, unknown>)
  )

  useEffect(() => {
    setTypedFlags({
      ...readTypedFlags(flags as Record<string, unknown>),
      ...getLocalFeatureFlagOverrides(),
    })
  }, [flags])

  useEffect(() => {
    if (!ldClient) return
    const ctx = user
      ? contextFromAuth(user.uid, user.email)
      : anonymousContext()
    void ldClient.identify(ctx).catch(() => {
      // Fail-closed: leave flags at defaults / last known values
    })
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
 */
export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const initialContext = useMemo(
    () =>
      user
        ? contextFromAuth(user.uid, user.email)
        : anonymousContext(),
    // Only seed once for LDProvider; identify() handles later auth changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  if (!CLIENT_SIDE_ID) {
    return (
      <FeatureFlagContext.Provider
        value={{ ...FEATURE_FLAG_DEFAULTS, ...getLocalFeatureFlagOverrides() }}
      >
        {children}
      </FeatureFlagContext.Provider>
    )
  }

  return (
    <LDProvider
      clientSideID={CLIENT_SIDE_ID}
      context={initialContext}
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
