'use client'

import { createContext } from 'react'
import type { FeatureFlagKey } from '@/lib/flags/featureFlags'

export type FeatureFlagMap = Partial<Record<FeatureFlagKey, boolean>>

/** Shared flag values; empty map means all flags evaluate false (fail-closed). */
export const FeatureFlagContext = createContext<FeatureFlagMap>({})
