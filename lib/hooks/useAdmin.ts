'use client'

import { useAuth } from './useAuth'

export const useAdmin = () => {
  const { userData } = useAuth()

  const isAdmin = userData?.role === 'admin' || userData?.role === 'superAdmin'
  const isSuperAdmin = userData?.role === 'superAdmin'

  return {
    isAdmin,
    isSuperAdmin,
    role: userData?.role || 'user',
  }
}
