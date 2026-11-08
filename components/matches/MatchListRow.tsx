import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { MatchDateBlock } from '@/components/matches/MatchDateBlock'
import { MATCH_STATUS_TEXT_CLASS } from '@/components/matches/matchStatusText'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import type { MatchRsvpStatus } from '@/lib/utils/matchStatus'
import type { Match } from '@/types/match'

/** Compact fixture row linking to the match: date tile, kickoff · venue, status. */
export function MatchListRow({
  match,
  href,
  status,
  actions,
}: {
  match: Match
  href: string
  status: MatchRsvpStatus
  /** Controls (e.g. admin Delete) placed beside the row link, never inside it. */
  actions?: ReactNode
}) {
  const matchDate = new Date(match.date)
  const locationName = match.location
    ? locationDisplayName(match.location)
    : null

  return (
    <li className="flex items-center gap-2">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg py-3.5 outline-none transition-colors hover:bg-turf/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MatchDateBlock date={matchDate} showMonth={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-[15px] font-semibold text-chalk">
            <span className="sr-only">
              {format(matchDate, 'EEEE, MMM d')} ·{' '}
            </span>
            {format(matchDate, 'h:mm a')}
            {locationName ? ` · ${locationName}` : ''}
          </p>
          <p className={cn('text-sm', MATCH_STATUS_TEXT_CLASS[status.tone])}>
            {status.label}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-fog" aria-hidden />
      </Link>
      {actions}
    </li>
  )
}
