'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'

interface AdminRouteGuardProps {
  children: React.ReactNode
}

export function AdminRouteGuard({
  children,
}: AdminRouteGuardProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { isAdmin } = useAdmin()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }

      if (!isAdmin) {
        router.push('/matches')
        return
      }
    }
  }, [user, loading, isAdmin, router])

  if (loading) {
    return <PageLoadingSkeleton variant="centered" />
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
