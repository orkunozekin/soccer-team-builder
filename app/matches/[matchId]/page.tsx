'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchDetailView } from '@/components/matches/MatchDetailView'
import { useAuth } from '@/lib/hooks/useAuth'

export default function MatchDetailsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.uid

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }
  }, [authLoading, userId, router])

  if (authLoading) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!userId) {
    return null
  }

  return (
    <MatchDetailView
      backLink={{ href: '/matches', label: 'Back to Matches' }}
    />
  )
}
