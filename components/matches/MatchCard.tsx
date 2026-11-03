'use client'

import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { ChevronRight, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import { MatchDateBlock } from '@/components/matches/MatchDateBlock'
import { StatusPill } from '@/components/ui/status-pill'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import { getRsvpStatusForMatch } from '@/lib/utils/matchStatus'
import { Match } from '@/types/match'

interface MatchCardProps {
  match: Match
  rsvpCount?: number
  /** Index for staggered entrance animation */
  index?: number
  /** Detail URL. Defaults to legacy `/matches/[id]` (redirects to club path). */
  href?: string
  /**
   * Controls (e.g. admin Delete) rendered in the card's footer. Kept outside
   * the detail link so buttons are never nested inside an anchor.
   */
  actions?: ReactNode
}

export function MatchCard({
  match,
  rsvpCount,
  index = 0,
  href,
  actions,
}: MatchCardProps) {
  const detailHref = href ?? `/matches/${match.id}`
  const matchDate = new Date(match.date)
  const status = getRsvpStatusForMatch(match)
  const locationName = match.location
    ? locationDisplayName(match.location)
    : null

  const cardContent = (
    <article
      className={cn(
        'flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-colors sm:p-5',
        actions && 'pb-16 sm:pb-16',
        'hover:border-line hover:bg-turf-raised',
        match.rsvpOpen && 'border-[#4A1E19]'
      )}
    >
      <MatchDateBlock date={matchDate} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="font-display text-2xl font-extrabold uppercase leading-none tracking-[0.01em]">
          <span className="sr-only">{format(matchDate, 'EEEE, MMM d')} · </span>
          {format(matchDate, 'h:mm a')}
        </h3>
        {locationName ? (
          <p className="flex items-start gap-1.5 text-sm text-[#B9C2BD]">
            <MapPin
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime"
              aria-hidden
            />
            <span className="min-w-0 break-words">{locationName}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {rsvpCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#B9C2BD]">
              <Users className="h-3.5 w-3.5 text-fog" aria-hidden />
              {rsvpCount} {rsvpCount === 1 ? 'player' : 'players'} confirmed
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        className="mt-1 h-5 w-5 shrink-0 self-center text-fog"
        aria-hidden
      />
    </article>
  )

  return (
    <div
      className="relative h-full w-full animate-slide-up-fade"
      style={{
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <Link
        href={detailHref}
        className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {cardContent}
      </Link>
      {actions ? (
        <div className="absolute bottom-4 left-[5.5rem] right-4 flex flex-wrap items-center gap-2 sm:left-[6rem]">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
