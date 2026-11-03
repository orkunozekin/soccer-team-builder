'use client'

import { createContext } from 'react'
import type { FeatureFlagKey } from '@/lib/flags/featureFlags'

export type FeatureFlagMap = Partial<Record<FeatureFlagKey, boolean>>

/** Shared flag values; empty map means all flags evaluate false (fail-closed). */
export const FeatureFlagContext = createContext<FeatureFlagMap>({})

/**
 * False only while LaunchDarkly is still evaluating flags for the current
 * user. LD unavailable, errored or timed out counts as ready (values stay at
 * the fail-closed defaults), so the default with no provider is `true`.
 */
export const FeatureFlagsReadyContext = createContext<boolean>(true)
