'use client'

import { ClubSubNav } from '@/components/layout/ClubSubNav'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Sticky platform bar + club sub-nav (signed-in). Signed-out users only see
 * the centered Soccerville header from Navigation.
 */
export function AppShell() {
  const { user, loading } = useAuth()

  return (
    <div className="sticky top-0 z-20 mb-4">
      <Navigation />
      {!loading && user ? <ClubSubNav /> : null}
    </div>
  )
}
