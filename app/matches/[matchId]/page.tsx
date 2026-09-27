'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { getMatch } from '@/lib/services/matchService'
import {
  clubMatchPath,
  resolveLegacyMatchesRedirectSlug,
} from '@/lib/utils/clubPaths'

function paramToString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
    return value[0]
  }
  return undefined
}

/**
 * Legacy `/matches/[matchId]` → `/c/{slug}/matches/[matchId]`.
 * Prefers the match's club slug when the caller may open it; otherwise the
 * active/sole membership slug. No membership → `/join`.
 */
export default function MatchDetailsRedirectPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = paramToString(params?.matchId)
  const { user, userData, loading: authLoading } = useAuth()
  const { memberships, loading: membershipsLoading } = useClubMemberships()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (membershipsLoading || !matchId) return

    let cancelled = false

    const run = async () => {
      try {
        const match = await getMatch(matchId)
        if (cancelled) return

        if (!match) {
          setFailed(true)
          return
        }

        const matchClubId =
          typeof match.clubId === 'string' ? match.clubId.trim() : ''
        const matchClubMembership = matchClubId
          ? memberships.find(
              m => m.status === 'active' && m.clubId === matchClubId
            )
          : null

        const slug =
          matchClubMembership?.club.slug ??
          resolveLegacyMatchesRedirectSlug({
            memberships,
            activeClubId: userData?.activeClubId,
          })

        if (!slug) {
          router.replace('/join')
          return
        }

        router.replace(clubMatchPath(slug, matchId))
      } catch (err) {
        console.error('Failed to redirect match detail:', err)
        if (!cancelled) setFailed(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    user,
    membershipsLoading,
    memberships,
    userData?.activeClubId,
    matchId,
    router,
  ])

  if (failed) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Match not found.
        </p>
      </div>
    )
  }

  return <PageLoadingSkeleton showBack variant="container" />
}
