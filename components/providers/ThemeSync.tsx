'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useFeatureFlag, useFeatureFlagReady } from '@/lib/flags/useFeatureFlag'
import { useAuthStore } from '@/store/authStore'
import { normalizeThemePreference } from '@/types/user'

/**
 * Applies the signed-in user's theme once their profile has loaded.
 *
 * - Signed out, profile pending, or flags still loading: leave the current
 *   (cached) theme alone so a slow load never flips a light user to dark.
 * - Flag off: dark.
 * - Flag on: the profile's `themePreference` (missing → dark).
 *
 * Only a profile whose uid matches the current auth user is applied, so a
 * fast account switch can never apply the previous user's preference.
 */
export function ThemeSync() {
  const { setTheme } = useTheme()
  const uid = useAuthStore(state => state.user?.uid ?? null)
  const profileReady = useAuthStore(state => state.profileReady)
  const profileUid = useAuthStore(state => state.userData?.uid ?? null)
  const storedPreference = useAuthStore(
    state => state.userData?.themePreference
  )
  const flagOn = useFeatureFlag('light-theme')
  const flagReady = useFeatureFlagReady('light-theme')

  useEffect(() => {
    if (!uid || !profileReady || !flagReady) return
    if (!flagOn) {
      setTheme('dark')
      return
    }
    // Profile not loaded for this uid (stale doc from the previous user, or
    // the fetch failed): keep the current theme rather than guess.
    if (profileUid !== uid) return
    setTheme(normalizeThemePreference(storedPreference))
  }, [
    uid,
    profileReady,
    profileUid,
    storedPreference,
    flagOn,
    flagReady,
    setTheme,
  ])

  return null
}
