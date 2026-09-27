'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import {
  clubMatchesPath,
  resolveLegacyMatchesRedirectSlug,
} from '@/lib/utils/clubPaths'

/**
 * Legacy `/matches` → `/c/{slug}/matches` (or `/join` with no membership).
 */
export default function MatchesRedirectPage() {
  const router = useRouter()
  const { user, userData, loading: authLoading } = useAuth()
  const { memberships, loading: membershipsLoading } = useClubMemberships()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (membershipsLoading) return

    const slug = resolveLegacyMatchesRedirectSlug({
      memberships,
      activeClubId: userData?.activeClubId,
    })
    if (!slug) {
      router.replace('/join')
      return
    }
    router.replace(clubMatchesPath(slug))
  }, [
    authLoading,
    user,
    membershipsLoading,
    memberships,
    userData?.activeClubId,
    router,
  ])

  return <PageLoadingSkeleton variant="container" />
}
