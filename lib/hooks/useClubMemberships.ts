'use client'

import { useCallback } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { getMyClubsAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from './useAuth'
import type { ClubMembershipWithClub } from '@/types/club'
import { normalizeUserRole } from '@/types/user'

export function myClubsKey(uid: string) {
  return ['my-clubs', uid] as const
}

function isMyClubsKey(key: unknown): key is ReturnType<typeof myClubsKey> {
  return Array.isArray(key) && key[0] === 'my-clubs'
}

/** Invalidate cached memberships after join / leave / role changes. */
export async function revalidateMyClubs(uid?: string | null) {
  if (uid) {
    await globalMutate(myClubsKey(uid))
    return
  }
  await globalMutate(isMyClubsKey)
}

/**
 * Call after a successful invite redeem so SWR caches and activeClubId stay in sync.
 * Redeem may set activeClubId server-side when it was previously unset.
 */
export async function afterInviteRedeemed(input: {
  uid: string
  clubId?: string | null
  alreadyMember?: boolean
}) {
  await revalidateMyClubs(input.uid)
  if (input.alreadyMember || !input.clubId) return
  const { userData, setUserData } = useAuthStore.getState()
  if (userData && !userData.activeClubId) {
    setUserData({ ...userData, activeClubId: input.clubId })
  }
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
    },
    {
      // Role changes can be made from another browser/session. Revalidate when
      // club-scoped screens mount so a stale player role cannot hide admin UI.
      revalidateOnMount: true,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
      errorRetryCount: 1,
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return {
    memberships: (data ?? []) as ClubMembershipWithClub[],
    loading:
      Boolean(uid) &&
      ((isLoading && data === undefined) ||
        (isValidating && data === undefined)),
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
  const { memberships, loading, error, refresh } = useClubMemberships()
  const isSuperUser = normalizeUserRole(userData?.role) === 'super_user'

  if (isSuperUser) {
    return {
      isClubAdmin: true,
      isSuperUser: true,
      loading: false,
      error: null,
      refresh,
    }
  }

  if (!clubId) {
    return {
      isClubAdmin: false,
      isSuperUser: false,
      loading,
      error,
      refresh,
    }
  }

  const membership = memberships.find(
    m => m.clubId === clubId && m.status === 'active'
  )
  return {
    isClubAdmin: membership?.role === 'club_admin',
    isSuperUser: false,
    loading,
    error,
    refresh,
  }
}
