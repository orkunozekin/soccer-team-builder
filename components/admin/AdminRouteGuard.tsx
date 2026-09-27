'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'

interface AdminRouteGuardProps {
  children: React.ReactNode
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { isAdmin, rolePending } = useAdmin()
  const pending = loading || rolePending

  useEffect(() => {
    if (pending) return
    if (!user) {
      router.push('/login')
      return
    }

    if (!isAdmin) {
      router.push('/matches')
    }
  }, [user, pending, isAdmin, router])

  if (pending) {
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
            You need super user privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
