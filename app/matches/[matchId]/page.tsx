'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MatchDetailView } from '@/components/matches/MatchDetailView'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'

export default function MatchDetailsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
  }, [authLoading, user, router])

  if (authLoading) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!user) {
    return null
  }

  return (
    <MatchDetailView
      backLink={{ href: '/matches', label: 'Back to Matches' }}
    />
  )
}
