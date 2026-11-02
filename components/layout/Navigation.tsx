'use client'

import { Wordmark } from '@/components/layout/Wordmark'
import { NavLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'

/** Signed-out Soccerville header. Signed-in chrome lives on AppShell. */
export function Navigation() {
  const { user, loading } = useAuth()

  if (loading) {
    return <NavLoadingSkeleton />
  }

  if (user) return null

  return (
    <header className="py-4 text-chalk">
      <div className="container mx-auto px-4">
        <Wordmark />
      </div>
    </header>
  )
}
