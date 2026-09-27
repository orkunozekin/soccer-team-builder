'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClubBySlugAPI } from '@/lib/api/client'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import type { Club } from '@/types/club'

export type ResolvedClubAccess =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string; retry: () => void }
  | {
      status: 'ok'
      club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
    }

type RemoteState = {
  slug: string
  status: 'loading' | 'ok' | 'forbidden' | 'error'
  club?: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
  message?: string
  attempt: number
}

/**
 * Resolve `/c/[slug]` access for the signed-in user.
 * Members resolve from memberships; super users without membership hit the
 * by-slug API. Non-members and unknown slugs both surface as forbidden (404).
 * Transient by-slug failures surface as `error` with retry (not "not found").
 */
export function useClubSlugAccess(slug: string | undefined): ResolvedClubAccess {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin: isSuperUser } = useAdmin()
  const {
    memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refresh: refreshMemberships,
  } = useClubMemberships()
  const [remote, setRemote] = useState<RemoteState | null>(null)
  const [attempt, setAttempt] = useState(0)

  const normalized = typeof slug === 'string' ? slug.trim() : ''
  const membershipClubId =
    normalized &&
    memberships.find(
      m => m.status === 'active' && m.club.slug === normalized
    )?.clubId

  const fromMembership = membershipClubId
    ? memberships.find(m => m.clubId === membershipClubId)
    : undefined

  const retry = useCallback(() => {
    void refreshMemberships()
    setAttempt(n => n + 1)
  }, [refreshMemberships])

  useEffect(() => {
    if (!normalized || authLoading || !user || membershipsLoading) {
      return
    }
    if (membershipClubId) {
      setRemote(null)
      return
    }
    // Membership fetch failed with an empty list — do not treat as "not a member".
    if (membershipsError) {
      setRemote(null)
      return
    }
    // Members without this slug → 404 without probing the API.
    if (!isSuperUser) {
      setRemote({
        slug: normalized,
        status: 'forbidden',
        attempt,
      })
      return
    }

    let cancelled = false
    setRemote({ slug: normalized, status: 'loading', attempt })

    void getClubBySlugAPI(normalized)
      .then(res => {
        if (cancelled) return
        setRemote({
          slug: normalized,
          status: 'ok',
          club: res.club,
          attempt,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const status =
          err && typeof err === 'object' && 'status' in err
            ? Number((err as { status?: number }).status)
            : undefined
        if (status === 404) {
          setRemote({ slug: normalized, status: 'forbidden', attempt })
          return
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load club'
        setRemote({
          slug: normalized,
          status: 'error',
          message,
          attempt,
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    normalized,
    authLoading,
    user,
    membershipsLoading,
    membershipsError,
    membershipClubId,
    isSuperUser,
    attempt,
  ])

  if (!normalized) return { status: 'forbidden' }
  if (authLoading) return { status: 'loading' }
  if (!user) return { status: 'unauthenticated' }
  if (membershipsLoading && !fromMembership) return { status: 'loading' }

  if (fromMembership) {
    return {
      status: 'ok',
      club: {
        id: fromMembership.club.id,
        name: fromMembership.club.name,
        slug: fromMembership.club.slug,
        settings: fromMembership.club.settings,
      },
    }
  }

  // Empty memberships after a fetch error must not look like a 404.
  if (membershipsError) {
    return {
      status: 'error',
      message: membershipsError,
      retry,
    }
  }

  if (!isSuperUser) return { status: 'forbidden' }
  if (!remote || remote.slug !== normalized || remote.status === 'loading') {
    return { status: 'loading' }
  }
  if (remote.status === 'ok' && remote.club) {
    return { status: 'ok', club: remote.club }
  }
  if (remote.status === 'error') {
    return {
      status: 'error',
      message: remote.message || 'Failed to load club',
      retry,
    }
  }
  return { status: 'forbidden' }
}
