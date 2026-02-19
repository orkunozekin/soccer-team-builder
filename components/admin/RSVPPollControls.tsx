'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Match } from '@/types/match'
import { updateMatch } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'
import { shouldRSVPBeOpen, getRSVPSchedule } from '@/lib/utils/rsvpScheduler'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RSVPPollControlsProps {
  match: Match
}

export function RSVPPollControls({ match }: RSVPPollControlsProps) {
  const { updateMatch: updateMatchStore } = useMatchStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const schedule = getRSVPSchedule(match.date)
  const isOpenBySchedule = shouldRSVPBeOpen(
    match.date,
    match.rsvpOpenAt,
    match.rsvpCloseAt
  )

  const handleToggleRSVP = async (open: boolean) => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      if (open) {
        // Open RSVP - use manual override or schedule
        const openAt = match.rsvpOpenAt || schedule.openAt || new Date()
        const closeAt = match.rsvpCloseAt || schedule.closeAt || new Date()

        await updateMatch(match.id, {
          rsvpOpen: true,
          rsvpOpenAt: openAt,
          rsvpCloseAt: closeAt,
        })

        updateMatchStore(match.id, {
          rsvpOpen: true,
          rsvpOpenAt: openAt,
          rsvpCloseAt: closeAt,
        })
      } else {
        // Close RSVP
        await updateMatch(match.id, {
          rsvpOpen: false,
        })

        updateMatchStore(match.id, {
          rsvpOpen: false,
        })
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update RSVP status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RSVP Poll Controls</CardTitle>
        <CardDescription>
          Manually control RSVP poll status for this match
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Current Status:</span>
          <Badge variant={match.rsvpOpen ? 'default' : 'outline'}>
            {match.rsvpOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>

        {schedule.openAt && schedule.closeAt && (
          <div className="text-sm space-y-1">
            <p className="text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">Scheduled:</span>{' '}
              {format(schedule.openAt, 'MMM d, h:mm a')} -{' '}
              {format(schedule.closeAt, 'h:mm a')}
            </p>
            {match.rsvpOpenAt && match.rsvpCloseAt && (
              <p className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Manual Override:</span>{' '}
                {format(match.rsvpOpenAt, 'MMM d, h:mm a')} -{' '}
                {format(match.rsvpCloseAt, 'h:mm a')}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            RSVP status updated successfully!
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => handleToggleRSVP(true)}
            disabled={loading || match.rsvpOpen}
            className="flex-1 h-11 sm:h-9"
          >
            {loading ? 'Updating...' : 'Open RSVP'}
          </Button>
          <Button
            onClick={() => handleToggleRSVP(false)}
            disabled={loading || !match.rsvpOpen}
            variant="outline"
            className="flex-1 h-11 sm:h-9"
          >
            {loading ? 'Updating...' : 'Close RSVP'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
