'use client'

import { format } from 'date-fns'
import { Calendar, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getNextRSVPCloseTime,
  getNextRSVPOpenTime,
} from '@/lib/utils/rsvpScheduler'
import { locationDisplayName } from '@/lib/utils/location'
import { Match } from '@/types/match'

interface MatchCardProps {
  match: Match
  rsvpCount?: number
  /** When true, card is always clickable and shows "Click to view details and RSVP" */
  isAdmin?: boolean
  /** Index for staggered entrance animation */
  index?: number
}

export function MatchCard({
  match,
  rsvpCount,
  isAdmin,
  index = 0,
}: MatchCardProps) {
  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMM d')
  const formattedTime = format(matchDate, 'h:mm a')
  const rsvpOpenAt = getNextRSVPOpenTime(matchDate, match.time)
  const rsvpCloseAt = getNextRSVPCloseTime(matchDate, match.time)
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
      className={`card-soccer-accent h-full transition-all duration-300 ${
        isClickable
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-red-50/10'
          : 'cursor-default opacity-95'
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="mb-1 text-xl">{formattedDate}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-base">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-red-50" />
              {formattedTime}
            </CardDescription>
            {match.location && locationDisplayName(match.location) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-red-50" />
                <span className="truncate">
                  {locationDisplayName(match.location)}
                </span>
              </p>
            )}
          </div>
          <Badge
            variant={match.rsvpOpen ? 'default' : 'outline'}
            className={`shrink-0 py-1 text-xs ${
              match.rsvpOpen ? 'animate-badge-pulse' : ''
            }`}
          >
            {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rsvpCount !== undefined && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Users className="h-3.5 w-3.5 text-red-50" />
            {rsvpCount} {rsvpCount === 1 ? 'player' : 'players'} confirmed
          </p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{statusLabel}</p>
      </CardContent>
    </Card>
  )

  if (isClickable) {
    return (
      <div
        className="animate-slide-up-fade h-full"
        style={{
          animationDelay: `${index * 80}ms`,
          animationFillMode: 'backwards',
        }}
      >
        <Link href={`/matches/${match.id}`} className="block h-full">
          {cardContent}
        </Link>
      </div>
    )
  }

  return (
    <div
      className="animate-slide-up-fade h-full"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {cardContent}
    </div>
  )
}
