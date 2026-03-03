'use client'

import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { MatchDetailView } from '@/components/matches/MatchDetailView'

export default function AdminMatchPage() {
  return (
    <AdminRouteGuard>
      <MatchDetailView
        backLink={{ href: '/admin', label: 'Back to Admin Dashboard' }}
      />
    </AdminRouteGuard>
  )
}
