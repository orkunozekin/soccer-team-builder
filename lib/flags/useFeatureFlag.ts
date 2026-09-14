'use client'

import { useContext } from 'react'
import {
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlagKey,
} from '@/lib/flags/featureFlags'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'

/**
 * Evaluate a typed boolean feature flag.
 * Fail-closed: missing client key, LD errors, or unknown flags → false.
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const flags = useContext(FeatureFlagContext)
  if (typeof flags[key] === 'boolean') return flags[key]
  return FEATURE_FLAG_DEFAULTS[key]
}
