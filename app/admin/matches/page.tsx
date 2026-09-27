'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ClubMatchesView } from '@/components/matches/ClubMatchesView'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * All-clubs match management for super users.
 * Do not redirect through `/matches`: that route sends members to their club
 * and hides this list.
 */
export default function AdminMatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin } = useAdmin()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!isAdmin) {
      router.replace('/matches')
    }
  }, [authLoading, user, isAdmin, router])

  if (authLoading || !user || !isAdmin) {
    return <PageLoadingSkeleton variant="container" />
  }

  return <ClubMatchesView clubId={null} clubSlug={null} />
}
