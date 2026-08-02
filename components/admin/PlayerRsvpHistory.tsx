'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAllMatches } from '@/lib/services/matchService'
import { getUserRSVPs } from '@/lib/services/rsvpService'
import { isCheckInWindowEnded } from '@/lib/utils/checkIn'
import { locationDisplayName } from '@/lib/utils/location'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

type HistoryLabel = 'Present' | 'No-show' | 'Pending' | 'Cancelled'

interface HistoryRow {
  rsvp: RSVP
  match: Match | null
  label: HistoryLabel
}

function attendanceLabel(rsvp: RSVP, match: Match | null): HistoryLabel {
  if (rsvp.status === 'cancelled') return 'Cancelled'
  if (rsvp.attended === true) return 'Present'
  if (match && isCheckInWindowEnded(match.date, match.time)) return 'No-show'
  return 'Pending'
}

function badgeClassName(label: HistoryLabel): string {
  if (label === 'Present') {
    return 'border-transparent bg-emerald-600 text-white hover:bg-emerald-600'
  }
  if (label === 'No-show') {
    return 'border-transparent bg-red-600 text-white hover:bg-red-600'
  }
  return ''
}

function badgeVariant(
  label: HistoryLabel
): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (label === 'Present' || label === 'No-show') return 'outline'
  if (label === 'Cancelled') return 'secondary'
  return 'outline'
}

interface PlayerRsvpHistoryProps {
  userId: string
}

export function PlayerRsvpHistory({ userId }: PlayerRsvpHistoryProps) {
  const [rows, setRows] = useState<HistoryRow[]>([])
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
        const next: HistoryRow[] = rsvps.map(rsvp => {
          const match = matchesById.get(rsvp.matchId) ?? null
          return {
            rsvp,
            match,
            label: attendanceLabel(rsvp, match),
          }
        })
        next.sort((a, b) => {
          const ad = a.match?.date?.getTime() ?? a.rsvp.rsvpAt.getTime()
          const bd = b.match?.date?.getTime() ?? b.rsvp.rsvpAt.getTime()
          return bd - ad
        })
        setRows(next)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const summary = useMemo(() => {
    const confirmed = rows.filter(r => r.rsvp.status === 'confirmed').length
    const cancelled = rows.filter(r => r.rsvp.status === 'cancelled').length
    return { confirmed, cancelled, total: rows.length }
  }, [rows])

  return (
    <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm dark:border-zinc-800">
      <CardHeader className="pb-3 sm:px-8 sm:pt-8">
        <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
          RSVP History
        </CardTitle>
        <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
          {loading
            ? 'Loading match history…'
            : summary.total === 0
              ? 'No RSVPs yet'
              : `${summary.confirmed} confirmed · ${summary.cancelled} cancelled`}
        </CardDescription>
      </CardHeader>
      <CardContent className="sm:px-8 sm:pb-8">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            This player has not RSVP&apos;d to any matches yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map(({ rsvp, match, label }) => {
              const dateLabel = match
                ? format(match.date, 'EEE, MMM d')
                : 'Unknown match'
              const timeLabel = match?.time ? ` · ${match.time}` : ''
              const place = match ? locationDisplayName(match.location) : null
              return (
                <li
                  key={rsvp.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    {match ? (
                      <Link
                        href={`/admin/matches/${match.id}`}
                        className="truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                      >
                        {dateLabel}
                        {timeLabel}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {dateLabel}
                      </p>
                    )}
                    {place && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {place}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={badgeVariant(label)}
                    className={badgeClassName(label)}
                  >
                    {label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
