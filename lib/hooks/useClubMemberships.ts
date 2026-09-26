'use client'

import { useCallback, useEffect } from 'react'
import { getMyClubsAPI } from '@/lib/api/client'
import { useAuth } from './useAuth'
import { useClubMembershipsStore } from '@/store/clubMembershipsStore'
import type { ClubMembershipWithClub } from '@/types/club'
import { normalizeUserRole } from '@/types/user'

/**
 * Club memberships for the signed-in user.
 * Cached in a session store so navigating between pages does not refetch;
 * call `refresh()` after join / settings changes. Cleared on logout.
 */
export function useClubMemberships() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const memberships = useClubMembershipsStore(s => s.memberships)
  const loading = useClubMembershipsStore(s => s.loading)
  const error = useClubMembershipsStore(s => s.error)
  const loaded = useClubMembershipsStore(s => s.loaded)
  const cachedUid = useClubMembershipsStore(s => s.uid)
  const setLoading = useClubMembershipsStore(s => s.setLoading)
  const setError = useClubMembershipsStore(s => s.setError)
  const setMemberships = useClubMembershipsStore(s => s.setMemberships)
  const clear = useClubMembershipsStore(s => s.clear)

  const refresh = useCallback(async () => {
    if (!uid) {
      clear()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getMyClubsAPI()
      setMemberships(uid, res.memberships)
    } catch (err) {
      console.error('Failed to load club memberships:', err)
      setError(err instanceof Error ? err.message : 'Failed to load clubs')
      setLoading(false)
    }
  }, [uid, clear, setLoading, setError, setMemberships])

  useEffect(() => {
    if (!uid) {
      clear()
      return
    }
    // Reuse cached list for this user across route changes.
    if (loaded && cachedUid === uid) return
    void refresh()
  }, [uid, loaded, cachedUid, refresh, clear])

  return {
    memberships: memberships as ClubMembershipWithClub[],
    loading: Boolean(uid) && (loading || (!loaded && cachedUid !== uid)),
    error,
    refresh,
  }
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
