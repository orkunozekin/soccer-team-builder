'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getMatchesByIds } from '@/lib/services/matchService'
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
        const rsvps = await getUserRSVPs(userId)
        if (cancelled) return
        const matches = await getMatchesByIds(
          rsvps.map(r => r.matchId),
          { includeDeleted: true }
        )
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
    <Card className="overflow-hidden rounded-xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:px-8 sm:pt-8">
        <CardTitle className="text-2xl sm:text-3xl">Attendance</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Confirmed RSVPs vs shows after the check-in window
        </CardDescription>
      </CardHeader>
      <CardContent className="sm:px-8 sm:pb-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading stats…</p>
        ) : !stats || stats.confirmedCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No confirmed RSVPs yet. Stats appear after confirmed RSVPs to
            matches.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Confirmed
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {stats.confirmedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Attended
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {stats.attendedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                No-shows
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {stats.noShowCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Show rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {stats.showRate == null ? '—' : `${stats.showRate}%`}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
