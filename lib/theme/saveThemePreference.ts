import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import { THEME_SAVE_ERROR, useThemeSaveStore } from '@/store/themeSaveStore'
import type { ThemePreference } from '@/types/user'

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
    useThemeSaveStore.setState(state => ({
      error: { uid, message: THEME_SAVE_ERROR },
      resyncCount: state.resyncCount + 1,
    }))
  } finally {
    if (isLatest()) useThemeSaveStore.setState({ pendingUid: null })
  }
}
