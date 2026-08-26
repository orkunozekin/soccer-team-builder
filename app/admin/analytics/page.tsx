'use client'

import { AdminNav } from '@/components/admin/AdminNav'
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'

export default function AdminAnalyticsPage() {
  return (
    <div className="container mx-auto max-w-5xl min-w-0 px-4 py-8">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Analytics
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Review user activity, admin actions, and system events
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
