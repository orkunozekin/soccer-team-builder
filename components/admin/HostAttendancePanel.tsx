'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { hostCheckInAPI } from '@/lib/api/client'
import { isCheckInWindowEnded, isWithinCheckInWindow } from '@/lib/utils/checkIn'
import { useMatchStore } from '@/store/matchStore'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

interface HostAttendancePanelProps {
  match: Match
  rsvps: RSVP[]
  users: User[]
  onUpdated?: () => void | Promise<void>
}

type AttendanceLabel = 'Present' | 'No-show' | 'Pending'

function attendanceLabel(
  rsvp: RSVP,
  windowEnded: boolean
): AttendanceLabel {
  if (rsvp.attended === true) return 'Present'
  if (windowEnded && rsvp.status === 'confirmed') return 'No-show'
  return 'Pending'
}

export function HostAttendancePanel({
  match,
  rsvps,
  users,
  onUpdated,
}: HostAttendancePanelProps) {
  const { updateRSVPAttendance } = useMatchStore()
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const inWindow = isWithinCheckInWindow(match.date, match.time)
  const windowEnded = isCheckInWindowEnded(match.date, match.time)
  const usersById = useMemo(() => {
    const map = new Map(users.map(u => [u.uid, u]))
    return map
  }, [users])

  const sorted = useMemo(() => {
    return [...rsvps]
      .filter(r => r.status === 'confirmed')
      .sort((a, b) => {
        const an = usersById.get(a.userId)?.displayName || a.userId
        const bn = usersById.get(b.userId)?.displayName || b.userId
        return an.localeCompare(bn)
      })
  }, [rsvps, usersById])

  if (sorted.length === 0) return null
  if (!inWindow && !windowEnded && !sorted.some(r => r.attended === true)) {
    return null
  }

  const handleMark = async (userId: string, attended: boolean) => {
    setBusyUserId(userId)
    setError('')
    try {
      const res = await hostCheckInAPI(match.id, userId, attended)
      updateRSVPAttendance(res.rsvpId, {
        attended: attended ? true : null,
        checkedInAt: attended ? new Date() : null,
        checkInMethod: attended ? 'host' : null,
      })
      await onUpdated?.()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to update attendance'
      )
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Attendance</CardTitle>
        <CardDescription>
          Mark players present when GPS check-in fails. Window ends 2 hours
          after kickoff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {sorted.map(rsvp => {
            const user = usersById.get(rsvp.userId)
            const label = attendanceLabel(rsvp, windowEnded)
            const name = user?.displayName || user?.email || rsvp.userId
            return (
              <li
                key={rsvp.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/players/${rsvp.userId}`}
                    className="block truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {name}
                  </Link>
                  <Badge
                    variant="outline"
                    className={
                      label === 'Present'
                        ? 'mt-1 border-transparent bg-emerald-600 text-white hover:bg-emerald-600'
                        : label === 'No-show'
                          ? 'mt-1 border-transparent bg-red-600 text-white hover:bg-red-600'
                          : 'mt-1'
                    }
                  >
                    {label}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {rsvp.attended !== true ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyUserId === rsvp.userId}
                      disabled={busyUserId != null}
                      onClick={() => handleMark(rsvp.userId, true)}
                    >
                      Mark present
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyUserId === rsvp.userId}
                      disabled={busyUserId != null}
                      onClick={() => handleMark(rsvp.userId, false)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
