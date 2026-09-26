'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { getMyClubsAPI } from '@/lib/api/client'
import { useAuth } from './useAuth'
import type { ClubMembershipWithClub } from '@/types/club'
import { normalizeUserRole } from '@/types/user'

export function myClubsKey(uid: string) {
  return ['my-clubs', uid] as const
}

/**
 * Club memberships for the signed-in user (SWR-cached).
 * Call `refresh()` after join / settings changes. Key clears when logged out.
 */
export function useClubMemberships() {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    uid ? myClubsKey(uid) : null,
    async () => {
      const res = await getMyClubsAPI()
      return res.memberships
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return {
    memberships: (data ?? []) as ClubMembershipWithClub[],
    loading: Boolean(uid) && ((isLoading && data === undefined) || (isValidating && data === undefined)),
    error: error
      ? error instanceof Error
        ? error.message
        : 'Failed to load clubs'
      : null,
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
