import { format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import { getKickoffLabelForMatch } from '@/lib/utils/matchStatus'
import { getPlayerMatchStatus } from '@/lib/utils/playerMatchList'
import { describeRosterFill, getRosterFill } from '@/lib/utils/rosterFill'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

/**
 * "Next up" ticket for the soonest match. Card red while RSVP is open,
 * turf otherwise. The whole card is one link; the CTA pill is visual only.
 */
export function NextMatchHero({
  match,
  href,
  rsvpCount,
  myRsvp,
}: {
  match: Match
  href: string
  rsvpCount?: number
  myRsvp?: RSVP | null
}) {
  const matchDate = new Date(match.date)
  const status = getPlayerMatchStatus({ match, myRsvp, rsvpCount })
  const live = match.rsvpOpen && !myRsvp
  const locationName = match.location
    ? locationDisplayName(match.location)
    : null
  const cta = myRsvp ? 'View' : match.rsvpOpen ? 'RSVP' : 'Details'
  const fill = rsvpCount !== undefined ? getRosterFill(rsvpCount) : null

  const body = (
    <article
      className={cn(
        'relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl p-5 sm:p-7',
        live
          ? 'bg-red-50 text-white'
          : 'border border-border bg-card text-chalk'
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="pointer-events-none absolute -right-16 -top-12 -z-10 h-64 w-64 opacity-15"
      >
        <circle cx="50" cy="50" r="48" />
        <circle cx="50" cy="50" r="16" />
        <path d="M2 50h96" />
      </svg>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          Next up · {status.label}
        </p>
        <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em]">
          {getKickoffLabelForMatch(match)}
        </span>
      </div>

      <div>
        <h2 className="font-display text-6xl font-black uppercase leading-[0.88] sm:text-7xl">
          <span className="sr-only">{format(matchDate, 'EEEE')} </span>
          <span aria-hidden>{format(matchDate, 'EEE')} </span>
          {format(matchDate, 'MMM dd')}
        </h2>
        <p className="mt-2 font-display text-2xl font-extrabold uppercase sm:text-3xl">
          {format(matchDate, 'h:mm a')}
          {locationName ? ` · ${locationName}` : ''}
        </p>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4',
          live ? 'border-white/40' : 'border-line'
        )}
      >
        <p className="text-sm">
          {fill ? (
            <>
              <strong className="font-semibold">
                {fill.confirmed}/{fill.capacity}
              </strong>{' '}
              in · {describeRosterFill(fill)}
            </>
          ) : (
            ' '
          )}
        </p>
        <span
          aria-hidden
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold',
            live ? 'bg-white text-ink' : 'bg-chalk text-ink'
          )}
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  )

  return (
    <Link
      href={href}
      aria-label={`Next up: ${format(matchDate, 'EEEE, MMM d')} at ${format(matchDate, 'h:mm a')}${locationName ? `, ${locationName}` : ''}. ${status.label}. ${cta}`}
      className="block rounded-3xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      {body}
    </Link>
  )
}
