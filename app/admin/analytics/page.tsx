'use client'

import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function AdminAnalyticsPage() {
  return (
    <div className="container mx-auto min-w-0 max-w-7xl px-4 py-8">
      <PageHeader
        eyebrow="Super user"
        title="Analytics"
        description="Activity overview, trends, and recent events"
      />

      <AnalyticsDashboard />
    </div>
  )
}
