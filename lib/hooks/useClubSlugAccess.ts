'use client'

import { useEffect, useState } from 'react'
import { getClubBySlugAPI } from '@/lib/api/client'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import type { Club } from '@/types/club'

export type ResolvedClubAccess =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | {
      status: 'ok'
      club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
    }

/**
 * Resolve `/c/[slug]` access for the signed-in user.
 * Members resolve from memberships; super users without membership hit the
 * by-slug API. Non-members and unknown slugs both surface as forbidden (404).
 */
export function useClubSlugAccess(slug: string | undefined): ResolvedClubAccess {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin: isSuperUser } = useAdmin()
  const { memberships, loading: membershipsLoading } = useClubMemberships()
  const [remote, setRemote] = useState<{
    slug: string
    status: 'loading' | 'ok' | 'forbidden'
    club?: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
  } | null>(null)

  const normalized = typeof slug === 'string' ? slug.trim() : ''
  const membershipClubId =
    normalized &&
    memberships.find(
      m => m.status === 'active' && m.club.slug === normalized
    )?.clubId

  const fromMembership = membershipClubId
    ? memberships.find(m => m.clubId === membershipClubId)
    : undefined

  useEffect(() => {
    if (!normalized || authLoading || !user || membershipsLoading) {
      return
    }
    if (membershipClubId) {
      setRemote(null)
      return
    }
    // Members without this slug → 404 without probing the API.
    if (!isSuperUser) {
      setRemote({ slug: normalized, status: 'forbidden' })
      return
    }

    let cancelled = false
    setRemote({ slug: normalized, status: 'loading' })

    void getClubBySlugAPI(normalized)
      .then(res => {
        if (cancelled) return
        setRemote({ slug: normalized, status: 'ok', club: res.club })
      })
      .catch(() => {
        if (cancelled) return
        setRemote({ slug: normalized, status: 'forbidden' })
      })

    return () => {
      cancelled = true
    }
  }, [
    normalized,
    authLoading,
    user,
    membershipsLoading,
    membershipClubId,
    isSuperUser,
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

  if (!isSuperUser) return { status: 'forbidden' }
  if (!remote || remote.slug !== normalized || remote.status === 'loading') {
    return { status: 'loading' }
  }
  if (remote.status === 'ok' && remote.club) {
    return { status: 'ok', club: remote.club }
  }
  return { status: 'forbidden' }
}
