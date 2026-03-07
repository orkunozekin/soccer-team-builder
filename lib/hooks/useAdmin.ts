'use client'

import { useAuth } from './useAuth'

export const useAdmin = () => {
  const { userData } = useAuth()

  const isAdmin = userData?.role === 'admin'

  return {
    isAdmin,
    role: userData?.role || 'user',
  }
}
