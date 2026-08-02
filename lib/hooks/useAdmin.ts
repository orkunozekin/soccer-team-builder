'use client'

import { useAuth } from './useAuth'
import { isLocalDev } from '@/lib/utils/localDev'
import { useDevAdminUiStore } from '@/store/devAdminUiStore'

export const useAdmin = () => {
  const { userData } = useAuth()
  const hideAdminUi = useDevAdminUiStore(state => state.hideAdminUi)
  const hydrated = useDevAdminUiStore(state => state.hydrated)

  const roleIsAdmin = userData?.role === 'admin'
  const canToggleAdminUi = roleIsAdmin && isLocalDev()
  // Until localStorage hydrates, keep real admin status to avoid admin-route flash kicks.
  const effectivelyHidden = canToggleAdminUi && hydrated && hideAdminUi
  const isAdmin = roleIsAdmin && !effectivelyHidden

  return {
    isAdmin,
    roleIsAdmin,
    canToggleAdminUi,
    hideAdminUi: effectivelyHidden,
    role: userData?.role || 'user',
  }
}
