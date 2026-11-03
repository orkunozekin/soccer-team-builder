'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { MatchListRow } from '@/components/matches/MatchListRow'
import { NextMatchHero } from '@/components/matches/NextMatchHero'
import { Button } from '@/components/ui/button'
import { FilterPill, FilterPillGroup } from '@/components/ui/filter-pill'
import { Pagination } from '@/components/ui/pagination'
import { useClientPagination } from '@/lib/hooks/useClientPagination'
import type { MyMatchRsvpsState } from '@/lib/hooks/useMyMatchRsvps'
import {
  type PlayerMatchFilter,
  getMatchListFilters,
  getPlayerMatchStatus,
  selectMatchList,
} from '@/lib/utils/playerMatchList'
import type { Match } from '@/types/match'

const EMPTY_ROWS_MESSAGE: Record<PlayerMatchFilter, string> = {
  upcoming: 'No other upcoming matches.',
  mine: "You haven't RSVP'd to any other upcoming matches.",
  past: 'No past matches.',
}

/**
 * Matches list for everyone: a "Next up" hero for the soonest upcoming match,
 * then filter pills (Upcoming / I'm in, plus Past for people who manage
 * matches) and compact rows. Filters apply to the rows; the hero always shows
 * the next match.
 */
export function MatchesList({
  matches,
  rsvpCounts,
  hrefFor,
  myRsvps,
  onRetryMyRsvps,
  paginationScope,
  includePast = false,
  matchActions,
}: {
  matches: Match[]
  rsvpCounts: Record<string, number>
  hrefFor: (matchId: string) => string
  myRsvps: MyMatchRsvpsState
  onRetryMyRsvps: () => void
  paginationScope: string
  /** Offer the Past filter (club admins and super users). */
  includePast?: boolean
  /**
   * Per-match controls (e.g. Delete for matches the viewer manages), shown on
   * the Next up hero and on every row, always outside their links.
   */
  matchActions?: (match: Match) => ReactNode
}) {
  const [filter, setFilter] = useState<PlayerMatchFilter>('upcoming')
  const { next, rows } = useMemo(
    () => selectMatchList(matches, filter, myRsvps.byMatchId),
    [matches, filter, myRsvps.byMatchId]
  )
  const paged = useClientPagination(rows, `${paginationScope}:${filter}`)
  const heroActions = next ? matchActions?.(next) : null

  return (
    <div className="space-y-6">
      {next ? (
        <div className="space-y-2">
          <NextMatchHero
            match={next}
            href={hrefFor(next.id)}
            rsvpCount={rsvpCounts[next.id]}
            myRsvp={myRsvps.byMatchId.get(next.id)}
          />
          {heroActions ? (
            <div className="flex justify-end gap-2">{heroActions}</div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-card px-5 py-6 text-fog">
          No upcoming matches yet.
        </p>
      )}

      <section aria-labelledby="more-matches-heading" className="space-y-3">
        <h2 id="more-matches-heading" className="sr-only">
          More matches
        </h2>
        <FilterPillGroup role="group" aria-label="Filter matches">
          {getMatchListFilters(includePast).map(option => (
            <FilterPill
              key={option.value}
              active={filter === option.value}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </FilterPill>
          ))}
        </FilterPillGroup>

        {filter === 'mine' && myRsvps.status === 'error' ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-sm text-fog">Couldn&apos;t load your RSVPs.</p>
            <Button size="sm" variant="outline" onClick={onRetryMyRsvps}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-fog">
            {filter === 'mine' && myRsvps.status === 'loading'
              ? 'Loading your RSVPs…'
              : EMPTY_ROWS_MESSAGE[filter]}
          </p>
        ) : (
          <ul aria-label="Matches">
            {paged.items.map(match => (
              <MatchListRow
                key={match.id}
                match={match}
                href={hrefFor(match.id)}
                status={getPlayerMatchStatus({
                  match,
                  myRsvp: myRsvps.byMatchId.get(match.id),
                  rsvpCount: rsvpCounts[match.id],
                })}
                actions={matchActions?.(match)}
              />
            ))}
          </ul>
        )}
        {paged.pagination.totalPages > 1 && (
          <Pagination {...paged.pagination} itemLabel="matches" />
        )}
      </section>
    </div>
  )
}
