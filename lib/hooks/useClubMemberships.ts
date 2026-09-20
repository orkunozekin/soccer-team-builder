'use client'

import { useCallback, useEffect, useState } from 'react'
import { getMyClubsAPI } from '@/lib/api/client'
import { useAuth } from './useAuth'
import type { ClubMembershipWithClub } from '@/types/club'
import { normalizeUserRole } from '@/types/user'

export function useClubMemberships() {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<ClubMembershipWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getMyClubsAPI()
      setMemberships(res.memberships)
    } catch (err) {
      console.error('Failed to load club memberships:', err)
      setError(err instanceof Error ? err.message : 'Failed to load clubs')
      setMemberships([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { memberships, loading, error, refresh }
}

/**
 * Club-admin (or global super_user) for a specific club.
 * When clubId is missing, only super_user is treated as admin (pre-backfill).
 */
export function useIsClubAdmin(clubId: string | null | undefined) {
  const { userData } = useAuth()
  const { memberships, loading } = useClubMemberships()
  const isSuperUser = normalizeUserRole(userData?.role) === 'super_user'

  if (isSuperUser) {
    return { isClubAdmin: true, isSuperUser: true, loading: false }
  }

  if (!clubId) {
    return { isClubAdmin: false, isSuperUser: false, loading }
  }

  const membership = memberships.find(
    m => m.clubId === clubId && m.status === 'active'
  )
  return {
    isClubAdmin: membership?.role === 'club_admin',
    isSuperUser: false,
    loading,
  }
}
