'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LDProvider, useLDClient } from 'launchdarkly-react-client-sdk'
import {
  FeatureFlagContext,
  FeatureFlagsReadyContext,
} from '@/components/flags/FeatureFlagContext'
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

/** LD init timeout (seconds) passed to the provider and the bridge. */
const LD_TIMEOUT_S = 5

/**
 * Backstop for "flags ready": if the LD client never reaches the bridge (for
 * example `initialize` throws), stop waiting and treat flags as settled at
 * their fail-closed values.
 */
const FLAGS_READY_FALLBACK_MS = (LD_TIMEOUT_S * 2 + 2) * 1000

function flagsContextKey(uid: string | null | undefined): string {
  return uid ?? 'anonymous'
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

function closedFlags(): Partial<Record<FeatureFlagKey, boolean>> {
  return {
    ...FEATURE_FLAG_DEFAULTS,
    ...getLocalFeatureFlagOverrides(),
  }
}

/**
 * Syncs typed flags from the LD client into the outer context. Renders no
 * children so booting/remounting LD never remounts the app route tree.
 */
function LaunchDarklyBridge({
  onFlags,
  onReady,
}: {
  /** Called with the context key the flags were evaluated for. */
  onFlags: (
    key: string,
    flags: Partial<Record<FeatureFlagKey, boolean>>
  ) => void
  /** Called with the context key once flags have settled (or failed). */
  onReady: (key: string) => void
}) {
  const ldClient = useLDClient()
  const { user } = useAuth()
  const userId = user?.uid
  const userEmail = user?.email ?? null
  const contextKey = flagsContextKey(userId)

  const applyFlags = useCallback(
    (raw: Record<string, unknown>) => {
      onFlags(contextKey, {
        ...readTypedFlags(raw),
        ...getLocalFeatureFlagOverrides(),
      })
    },
    [onFlags, contextKey]
  )

  useEffect(() => {
    if (!ldClient) return
    let cancelled = false

    const syncFromClient = () => {
      if (cancelled) return
      applyFlags(ldClient.allFlags() as Record<string, unknown>)
    }

    void ldClient
      .waitForInitialization(LD_TIMEOUT_S)
      .then(syncFromClient)
      .catch(() => {
        // Fail-closed: leave defaults
      })
      .finally(() => {
        if (!cancelled) onReady(contextKey)
      })

    ldClient.on('change', syncFromClient)

    return () => {
      cancelled = true
      ldClient.off('change', syncFromClient)
    }
  }, [ldClient, applyFlags, onReady, contextKey])

  useEffect(() => {
    if (!ldClient) return
    let cancelled = false
    const ctx = userId ? contextFromAuth(userId, userEmail) : anonymousContext()

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
  }, [ldClient, userId, userEmail, applyFlags])

  return null
}

/**
 * App-wide LaunchDarkly provider. Nest under AuthProvider so context can use uid/email.
 * When the client ID is missing, children still render and all flags stay false.
 *
 * Children render as siblings of the LD client (not inside it) so auth finishing
 * or LD remounting never remounts route pages mid-navigation — a common cause of
 * stuck skeletons on mobile Chrome.
 */
export function LaunchDarklyProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  // Flags and readiness are per LD context (uid or anonymous). Values are
  // only exposed for the context they were evaluated for: after an account
  // switch the previous user's flags fall back to the fail-closed defaults,
  // so a failed or slow init for the new user can never certify them.
  const [evaluated, setEvaluated] = useState<{
    key: string
    flags: Partial<Record<FeatureFlagKey, boolean>>
  } | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const contextKey = flagsContextKey(user?.uid)
  const onFlags = useCallback(
    (key: string, flags: Partial<Record<FeatureFlagKey, boolean>>) =>
      setEvaluated({ key, flags }),
    []
  )

  const typedFlags = useMemo(
    () => (evaluated?.key === contextKey ? evaluated.flags : closedFlags()),
    [evaluated, contextKey]
  )

  useEffect(() => {
    if (!CLIENT_SIDE_ID || loading) return
    const timer = setTimeout(
      () => setReadyKey(contextKey),
      FLAGS_READY_FALLBACK_MS
    )
    return () => clearTimeout(timer)
  }, [contextKey, loading])

  if (!CLIENT_SIDE_ID) {
    return (
      <FeatureFlagContext.Provider value={closedFlags()}>
        <FeatureFlagsReadyContext.Provider value>
          {children}
        </FeatureFlagsReadyContext.Provider>
      </FeatureFlagContext.Provider>
    )
  }

  const context = user
    ? contextFromAuth(user.uid, user.email)
    : anonymousContext()

  return (
    <FeatureFlagContext.Provider value={typedFlags}>
      <FeatureFlagsReadyContext.Provider
        value={!loading && readyKey === contextKey}
      >
        {!loading ? (
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
            timeout={LD_TIMEOUT_S}
          >
            <LaunchDarklyBridge onFlags={onFlags} onReady={setReadyKey} />
          </LDProvider>
        ) : null}
        {children}
      </FeatureFlagsReadyContext.Provider>
    </FeatureFlagContext.Provider>
  )
}
