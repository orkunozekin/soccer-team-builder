'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ProfileClubsSection } from '@/components/profile/ProfileClubsSection'
import { useAuth } from '@/lib/hooks/useAuth'

export default function MyClubsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-8 sm:py-10">
      <PageHeader
        size="md"
        eyebrow="Account"
        title="My clubs"
        description="Memberships, invites, and clubs you admin"
      />
      <div>
        <ProfileClubsSection />
      </div>
    </div>
  )
}
