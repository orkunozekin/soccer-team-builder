'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAllMatches } from '@/lib/services/matchService'
import { getUserRSVPs } from '@/lib/services/rsvpService'
import { computeAttendanceStats } from '@/lib/utils/attendanceStats'
import type { AttendanceStats } from '@/lib/utils/attendanceStats'

interface AttendanceStatsCardProps {
  userId: string
}

export function AttendanceStatsCard({ userId }: AttendanceStatsCardProps) {
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [rsvps, matches] = await Promise.all([
          getUserRSVPs(userId),
          getAllMatches({ includeDeleted: true }),
        ])
        if (cancelled) return
        const matchesById = new Map(matches.map(m => [m.id, m]))
        setStats(computeAttendanceStats(rsvps, matchesById))
      } catch {
        if (!cancelled) setStats(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm dark:border-zinc-800">
      <CardHeader className="pb-3 sm:px-8 sm:pt-8">
        <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
          Attendance
        </CardTitle>
        <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
          Confirmed RSVPs vs shows after the check-in window
        </CardDescription>
      </CardHeader>
      <CardContent className="sm:px-8 sm:pb-8">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading stats…</p>
        ) : !stats || stats.confirmedCount === 0 ? (
          <p className="text-sm text-zinc-500">
            No confirmed RSVPs yet. Stats appear after confirmed RSVPs to
            matches.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Confirmed
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.confirmedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Attended
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.attendedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                No-shows
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.noShowCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Show rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {stats.showRate == null ? '—' : `${stats.showRate}%`}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
