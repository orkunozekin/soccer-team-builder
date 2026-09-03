'use client'

import { useEffect, useState } from 'react'
import { CardLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ActivityChart } from '@/components/admin/analytics/ActivityChart'
import { AnalyticsKpiCards } from '@/components/admin/analytics/AnalyticsKpiCards'
import { AuditEventLog } from '@/components/admin/analytics/AuditEventLog'
import { CategoryChart } from '@/components/admin/analytics/CategoryChart'
import { SourceChart } from '@/components/admin/analytics/SourceChart'
import { Card, CardContent } from '@/components/ui/card'
import { getAuditStatsAPI } from '@/lib/api/client'
import type { AuditStats } from '@/lib/audit/computeAuditStats'

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setLoading(true)
      setError('')
      try {
        const result = await getAuditStatsAPI()
        if (!cancelled) {
          setStats(result.stats)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStats(null)
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStats()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading && !stats) {
    return <CardLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {stats ? (
        <>
          <AnalyticsKpiCards stats={stats} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivityChart stats={stats} />
            </div>
            <SourceChart stats={stats} />
          </div>

          <CategoryChart stats={stats} />
        </>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <AuditEventLog />
        </CardContent>
      </Card>
    </div>
  )
}
