'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProfilePage() {
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
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Update your profile information
        </p>
      </div>

      <div className="mx-auto max-w-xl">
        <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm dark:border-zinc-800">
          <CardHeader className="pb-4 sm:px-8 sm:pt-8">
            <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
              Edit Profile
            </CardTitle>
            <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
              Display name, jersey number, and position
            </CardDescription>
          </CardHeader>
          <CardContent className="sm:px-8 sm:pb-8">
            <ProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
