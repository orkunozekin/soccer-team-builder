'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getNextRSVPCloseTime, getNextRSVPOpenTime } from '@/lib/utils/rsvpScheduler'
import { Match } from '@/types/match'

interface MatchCardProps {
  match: Match
  rsvpCount?: number
  /** When true, card is always clickable and shows "Click to view details and RSVP" */
  isAdmin?: boolean
}

export function MatchCard({ match, rsvpCount, isAdmin }: MatchCardProps) {
  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMM d')
  const formattedTime = format(matchDate, 'h:mm a')
  const rsvpOpenAt = getNextRSVPOpenTime(matchDate)
  const rsvpCloseAt = getNextRSVPCloseTime(matchDate)
  const now = new Date()

  const statusLabel = isAdmin
    ? 'Click to view details and RSVP'
    : match.rsvpOpen
      ? rsvpCloseAt && now < rsvpCloseAt
        ? `RSVP open until ${format(rsvpCloseAt, 'h:mm a')} CT`
        : 'RSVP open'
      : rsvpOpenAt && now < rsvpOpenAt
        ? `RSVP opens ${format(rsvpOpenAt, "MMM d 'at' h:mm a")} CT`
        : 'RSVP closed'

  const isClickable = isAdmin || match.rsvpOpen

  const cardContent = (
    <Card
      className={
        isClickable
          ? 'transition-all hover:shadow-md cursor-pointer h-full'
          : 'h-full cursor-default opacity-95'
      }
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{formattedDate}</CardTitle>
            <CardDescription className="text-base">
              {formattedTime}
            </CardDescription>
            {match.location && (
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                @ {match.location}
              </p>
            )}
          </div>
          <Badge
            variant={match.rsvpOpen ? 'default' : 'outline'}
            className="shrink-0 py-1 text-xs"
          >
            {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rsvpCount !== undefined && (
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {rsvpCount} {rsvpCount === 1 ? 'player' : 'players'} confirmed
          </p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {statusLabel}
        </p>
      </CardContent>
    </Card>
  )

  if (isClickable) {
    return <Link href={`/matches/${match.id}`}>{cardContent}</Link>
  }

  return cardContent
}
