'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useFeatureFlag, useFeatureFlagReady } from '@/lib/flags/useFeatureFlag'
import { useAuthStore } from '@/store/authStore'
import { useThemeSaveStore } from '@/store/themeSaveStore'
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
  // next-themes recreates `setTheme` whenever the theme changes. Keeping it
  // out of the effect deps means a theme change made elsewhere (the sidebar
  // toggle) doesn't re-run this effect and get reverted to the profile value.
  const setThemeRef = useRef(setTheme)
  setThemeRef.current = setTheme
  const uid = useAuthStore(state => state.user?.uid ?? null)
  const profileReady = useAuthStore(state => state.profileReady)
  const profileUid = useAuthStore(state => state.userData?.uid ?? null)
  const storedPreference = useAuthStore(
    state => state.userData?.themePreference
  )
  const flagOn = useFeatureFlag('light-theme')
  const flagReady = useFeatureFlagReady('light-theme')
  // A failed toggle save rolls back locally, then bumps this so the flag and
  // profile get the final say again.
  const resyncCount = useThemeSaveStore(state => state.resyncCount)

  useEffect(() => {
    if (!uid || !profileReady || !flagReady) return
    if (!flagOn) {
      setThemeRef.current('dark')
      return
    }
    // Profile not loaded for this uid (stale doc from the previous user, or
    // the fetch failed): keep the current theme rather than guess.
    if (profileUid !== uid) return
    setThemeRef.current(normalizeThemePreference(storedPreference))
  }, [
    uid,
    profileReady,
    profileUid,
    storedPreference,
    flagOn,
    flagReady,
    resyncCount,
  ])

  return null
}
