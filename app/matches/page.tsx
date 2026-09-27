'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ClubMatchesView } from '@/components/matches/ClubMatchesView'
import { Button } from '@/components/ui/button'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import {
  clubMatchesPath,
  resolveLegacyMatchesRedirectSlug,
} from '@/lib/utils/clubPaths'

/**
 * Legacy `/matches` → `/c/{slug}/matches` when a membership slug resolves.
 * Super users with no membership keep the all-clubs list here.
 * `?scope=all` is forwarded for super users so `/admin/matches` still opens
 * every club after they have a membership.
 * Membership load errors show retry (not `/join`).
 */
export default function MatchesRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scopeAll = searchParams.get('scope') === 'all'
  const { user, userData, loading: authLoading } = useAuth()
  const { isAdmin: isSuperUser } = useAdmin()
  const {
    memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refresh,
  } = useClubMemberships()

  const slug = resolveLegacyMatchesRedirectSlug({
    memberships,
    activeClubId: userData?.activeClubId,
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (membershipsLoading || membershipsError) return
    if (slug) {
      const dest = clubMatchesPath(slug)
      router.replace(scopeAll && isSuperUser ? `${dest}?scope=all` : dest)
      return
    }
    if (!isSuperUser) {
      router.replace('/join')
    }
  }, [
    authLoading,
    user,
    membershipsLoading,
    membershipsError,
    slug,
    isSuperUser,
    scopeAll,
    router,
  ])

  if (authLoading || (!user && !authLoading)) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!user) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (membershipsLoading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (membershipsError) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-red-700 dark:text-red-400">
          Could not load clubs. {membershipsError}
        </p>
        <Button
          type="button"
          className="mt-3"
          onClick={() => {
            void refresh()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (slug) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (isSuperUser) {
    // Platform operators without a membership keep the all-clubs list.
    return <ClubMatchesView clubId={null} clubSlug={null} />
  }

  return <PageLoadingSkeleton variant="container" />
}
