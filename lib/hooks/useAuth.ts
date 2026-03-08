'use client'

import { useAuthStore } from '@/store/authStore'

/**
 * Reads auth state from the store. Auth is initialized and kept in sync by
 * AuthProvider in the root layout; this hook does not subscribe to Firebase
 * so loading is not re-triggered when navigating to different pages.
 */
export const useAuth = () => {
  const user = useAuthStore(state => state.user)
  const userData = useAuthStore(state => state.userData)
  const loading = useAuthStore(state => state.loading)

  return {
    user,
    userData,
    loading,
    isAuthenticated: !!user,
  }
}
