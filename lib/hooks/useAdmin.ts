'use client'

import { useAuth } from './useAuth'
import { isLocalDev } from '@/lib/utils/localDev'
import { useDevAdminUiStore } from '@/store/devAdminUiStore'
import { normalizeUserRole } from '@/types/user'

/**
 * Platform super_user detection for /admin shell and platform nav.
 * Match-scoped controls should use useIsClubAdmin(clubId) instead.
 */
export const useAdmin = () => {
  const { user, userData, profileReady } = useAuth()
  const hideAdminUi = useDevAdminUiStore(state => state.hideAdminUi)
  const hydrated = useDevAdminUiStore(state => state.hydrated)

  const roleIsAdmin =
    normalizeUserRole(userData?.role) === 'super_user'
  const canToggleAdminUi = roleIsAdmin && isLocalDev()
  // Until localStorage hydrates, keep real admin status to avoid admin-route flash kicks.
  const effectivelyHidden = canToggleAdminUi && hydrated && hideAdminUi
  const isAdmin = roleIsAdmin && !effectivelyHidden
  // The auth loading timeout can clear `loading` before the user doc arrives.
  // Missing role is not the same as a confirmed non-admin.
  const rolePending = Boolean(user) && !profileReady

  return {
    /** True when global role is super_user (and not hidden via local-dev toggle). */
    isAdmin,
    /** Signed in, but the user doc (and therefore role) has not settled. */
    rolePending,
    isSuperUser: isAdmin,
    roleIsAdmin,
    canToggleAdminUi,
    hideAdminUi: effectivelyHidden,
    role: normalizeUserRole(userData?.role),
  }
}
