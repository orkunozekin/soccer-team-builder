'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
        My clubs
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Memberships, invites, and clubs you admin
      </p>
      <div className="mt-6">
        <ProfileClubsSection />
      </div>
    </div>
  )
}
