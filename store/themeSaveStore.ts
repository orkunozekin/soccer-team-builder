'use client'

import { create } from 'zustand'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import type { ThemePreference } from '@/types/user'

export const THEME_SAVE_ERROR = 'Couldn’t save your theme. Try again.'

interface ThemeSaveState {
  /** Bumped per save; only the latest save may touch shared state. */
  requestId: number
  /** uid whose save is in flight, or null. */
  pendingUid: string | null
  /** Last failed save, scoped to the uid it belongs to. */
  error: { uid: string; message: string } | null
}

const initialState: ThemeSaveState = {
  requestId: 0,
  pendingUid: null,
  error: null,
}

/**
 * Theme-save state shared by every `ThemeToggle` (desktop rail and mobile
 * sheet) and kept outside React, so a save that outlives its toggle (the
 * sheet closes) is still ordered and guarded against later saves and
 * account switches.
 */
export const useThemeSaveStore = create<ThemeSaveState>(() => initialState)

export function resetThemeSaveStore() {
  useThemeSaveStore.setState(initialState)
}

/**
 * Apply `next` at once, then persist it. On success, merge it into the
 * profile; on failure, restore `previous` and record an error. Either way,
 * only if this is still the latest save and `uid` is still signed in.
 */
export async function saveThemePreference({
  uid,
  next,
  previous,
  setTheme,
}: {
  uid: string
  next: ThemePreference
  previous: ThemePreference
  setTheme: (theme: string) => void
}) {
  const requestId = useThemeSaveStore.getState().requestId + 1
  useThemeSaveStore.setState({ requestId, pendingUid: uid, error: null })
  setTheme(next)

  const isLatest = () => useThemeSaveStore.getState().requestId === requestId
  try {
    await updateProfileAPI({ themePreference: next })
    if (!isLatest()) return
    const { user, userData, setUserData } = useAuthStore.getState()
    if (user?.uid === uid && userData?.uid === uid) {
      setUserData({ ...userData, themePreference: next })
    }
  } catch {
    if (!isLatest()) return
    if (useAuthStore.getState().user?.uid !== uid) return
    setTheme(previous)
    useThemeSaveStore.setState({
      error: { uid, message: THEME_SAVE_ERROR },
    })
  } finally {
    if (isLatest()) useThemeSaveStore.setState({ pendingUid: null })
  }
}
