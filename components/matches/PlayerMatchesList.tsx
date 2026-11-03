'use client'

import { useMemo, useState } from 'react'
import { MatchListRow } from '@/components/matches/MatchListRow'
import { NextMatchHero } from '@/components/matches/NextMatchHero'
import { Button } from '@/components/ui/button'
import { FilterPill, FilterPillGroup } from '@/components/ui/filter-pill'
import { Pagination } from '@/components/ui/pagination'
import { useClientPagination } from '@/lib/hooks/useClientPagination'
import type { MyMatchRsvpsState } from '@/lib/hooks/useMyMatchRsvps'
import {
  PLAYER_MATCH_FILTERS,
  type PlayerMatchFilter,
  filterPlayerMatches,
  getPlayerMatchStatus,
  splitNextMatch,
} from '@/lib/utils/playerMatchList'
import type { Match } from '@/types/match'

/**
 * Player match list: a "Next up" hero for the soonest match, then filter pills
 * and compact rows for the rest. Filters apply to the rows; the hero always
 * shows the next match.
 */
export function PlayerMatchesList({
  matches,
  rsvpCounts,
  hrefFor,
  canOpen,
  myRsvps,
  onRetryMyRsvps,
  paginationScope,
}: {
  matches: Match[]
  rsvpCounts: Record<string, number>
  hrefFor: (matchId: string) => string
  canOpen: (match: Match) => boolean
  myRsvps: MyMatchRsvpsState
  onRetryMyRsvps: () => void
  paginationScope: string
}) {
  const [filter, setFilter] = useState<PlayerMatchFilter>('upcoming')
  const { next, rest } = useMemo(() => splitNextMatch(matches), [matches])
  const rows = useMemo(
    () => filterPlayerMatches(rest, filter, myRsvps.byMatchId),
    [rest, filter, myRsvps.byMatchId]
  )
  const paged = useClientPagination(rows, `${paginationScope}:${filter}`)

  if (!next) return null

  return (
    <div className="space-y-6">
      <NextMatchHero
        match={next}
        href={hrefFor(next.id)}
        clickable={canOpen(next)}
        rsvpCount={rsvpCounts[next.id]}
        myRsvp={myRsvps.byMatchId.get(next.id)}
      />

      {rest.length > 0 ? (
        <section aria-labelledby="more-matches-heading" className="space-y-3">
          <h2 id="more-matches-heading" className="sr-only">
            More matches
          </h2>
          <FilterPillGroup role="group" aria-label="Filter matches">
            {PLAYER_MATCH_FILTERS.map(option => (
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
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 py-4"
            >
              <p className="text-sm text-fog">Couldn&apos;t load your RSVPs.</p>
              <Button size="sm" variant="outline" onClick={onRetryMyRsvps}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-fog">
              {filter === 'mine'
                ? myRsvps.status === 'loading'
                  ? 'Loading your RSVPs…'
                  : "You haven't RSVP'd to any other upcoming matches."
                : 'No other upcoming matches.'}
            </p>
          ) : (
            <ul aria-label="Matches">
              {paged.items.map(match => (
                <MatchListRow
                  key={match.id}
                  match={match}
                  href={hrefFor(match.id)}
                  clickable={canOpen(match)}
                  status={getPlayerMatchStatus({
                    match,
                    myRsvp: myRsvps.byMatchId.get(match.id),
                    rsvpCount: rsvpCounts[match.id],
                  })}
                />
              ))}
            </ul>
          )}
          {paged.pagination.totalPages > 1 && (
            <Pagination {...paged.pagination} itemLabel="matches" />
          )}
        </section>
      ) : null}
    </div>
  )
}
