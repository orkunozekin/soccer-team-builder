'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Former all-clubs list. Super users land on Matches with `?scope=all`
 * so the club page can show every club. `/matches` forwards that query
 * when the operator has a membership.
 */
export default function AdminMatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, rolePending } = useAdmin()
  const pending = authLoading || rolePending

  useEffect(() => {
    if (pending) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!isAdmin) {
      router.replace('/matches')
      return
    }
    router.replace('/matches?scope=all')
  }, [pending, user, isAdmin, router])

  return <PageLoadingSkeleton variant="container" />
}
