'use client'

import { useContext } from 'react'
import {
  FeatureFlagContext,
  FeatureFlagsReadyContext,
} from '@/components/flags/FeatureFlagContext'
import {
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagKey,
  getLocalFeatureFlagOverrides,
} from '@/lib/flags/featureFlags'

/**
 * Evaluate a typed boolean feature flag.
 * Fail-closed: missing client key, LD errors, or unknown flags → false.
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const flags = useContext(FeatureFlagContext)
  if (typeof flags[key] === 'boolean') return flags[key]
  return FEATURE_FLAG_DEFAULTS[key]
}

/**
 * Whether `useFeatureFlag(key)` has settled for the current user, so callers
 * can tell "LD still loading" from "off". LD unavailable or errored counts as
 * ready (the value is then the fail-closed default). A local
 * `NEXT_PUBLIC_FF_*` override is always ready.
 */
export function useFeatureFlagReady(key: FeatureFlagKey): boolean {
  const ready = useContext(FeatureFlagsReadyContext)
  if (ready) return true
  return getLocalFeatureFlagOverrides()[key] === true
}
