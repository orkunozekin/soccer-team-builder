import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { LocationLink } from '@/components/matches/LocationLink'
import { MatchDateBlock } from '@/components/matches/MatchDateBlock'
import { MATCH_STATUS_TEXT_CLASS } from '@/components/matches/matchStatusText'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import type { MatchRsvpStatus } from '@/lib/utils/matchStatus'
import type { Match } from '@/types/match'

/**
 * Compact fixture row: date tile, kickoff · venue, and a status line.
 * Rows that cannot be opened keep a maps link for the venue (opened rows
 * reach it on the detail page; a button inside the row link would nest).
 */
export function MatchListRow({
  match,
  href,
  clickable,
  status,
}: {
  match: Match
  href: string
  clickable: boolean
  status: MatchRsvpStatus
}) {
  const matchDate = new Date(match.date)
  const locationName = match.location
    ? locationDisplayName(match.location)
    : null
  const showMapsLink = !clickable && match.location && locationName

  const content = (
    <>
      <MatchDateBlock date={matchDate} showMonth={false} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[15px] font-semibold text-chalk">
          <span className="sr-only">{format(matchDate, 'EEEE, MMM d')} · </span>
          {format(matchDate, 'h:mm a')}
          {locationName && !showMapsLink ? ` · ${locationName}` : ''}
        </p>
        {showMapsLink && match.location ? (
          <LocationLink location={match.location} className="text-[13px]" />
        ) : null}
        <p className={cn('text-sm', MATCH_STATUS_TEXT_CLASS[status.tone])}>
          {status.label}
        </p>
      </div>
      {clickable ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-fog" aria-hidden />
      ) : null}
    </>
  )

  const rowClass =
    'flex items-center gap-4 border-b border-border py-3.5 outline-none'
  return (
    <li>
      {clickable ? (
        <Link
          href={href}
          className={cn(
            rowClass,
            'rounded-lg transition-colors hover:bg-turf/60 focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}
