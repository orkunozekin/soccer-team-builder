'use client'

import { NavLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'

function BrandLogo({ className }: { className?: string }) {
  return <span className={className}>Soccerville</span>
}

/** Signed-out Soccerville header. Signed-in chrome lives on AppShell. */
export function Navigation() {
  const { user, loading } = useAuth()

  if (loading) {
    return <NavLoadingSkeleton />
  }

  if (user) return null

  return (
    <header className="bg-red-50 py-3 font-semibold text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
      </div>
    </header>
  )
}
