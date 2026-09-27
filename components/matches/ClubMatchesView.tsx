'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminMatchCard } from '@/components/admin/AdminMatchCard'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchCard } from '@/components/matches/MatchCard'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { listMatchesForViewer } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { cn } from '@/lib/utils'
import {
  type MatchFilter,
  filterMatches,
} from '@/lib/utils/adminMatchFilters'
import {
  canCreateClubMatches,
  canManageMatchClub,
  filterMatchesForClubScope,
} from '@/lib/utils/clubMatches'
import { clubMatchPath } from '@/lib/utils/clubPaths'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'

const ADMIN_FILTERS: { value: MatchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

export type ClubMatchesViewProps = {
  /** Club to scope the list. `null` = all clubs (super_user legacy `/matches`). */
  clubId: string | null
  /** Slug for match detail links. `null` uses legacy `/matches/[id]` hrefs. */
  clubSlug: string | null
}

/**
 * Match list scoped to one club (used by `/c/[slug]/matches`).
 * Pass `clubId`/`clubSlug` null for the super-user all-clubs legacy list.
 */
export function ClubMatchesView({ clubId, clubSlug }: ClubMatchesViewProps) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.uid
  const { isAdmin: isSuperUser } = useAdmin()
  const { memberships, loading: membershipsLoading } = useClubMemberships()
  const { matches, setMatches } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<MatchFilter>('upcoming')
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  )
  const fetchGen = useRef(0)

  const canCreateMatch =
    Boolean(clubId) &&
    canCreateClubMatches({
      memberships,
      activeClubId: clubId,
      isSuperUser: !!isSuperUser,
    })
  /** Super users and club admins get the manage list (past matches, delete). */
  const showAdminList = !!isSuperUser || canCreateMatch

  const matchHref = (matchId: string) =>
    clubSlug ? clubMatchPath(clubSlug, matchId) : `/matches/${matchId}`

  const loadMatchesAndCounts = async (gen: number) => {
    try {
      const allMatches = await listMatchesForViewer({
        clubId,
        isSuperUser: !!isSuperUser,
      })
      if (gen !== fetchGen.current) return
      const scoped = filterMatchesForClubScope({
        matches: allMatches,
        memberships,
        activeClubId: clubId,
        isSuperUser: !!isSuperUser,
      })
      const listed = showAdminList
        ? scoped
        : scoped.filter(m => !isMatchPast(m.date, m.time))
      setMatches(listed)
      // Match list is usable without counts; do not fail the page if RSVP
      // queries error (e.g. missing composite index).
      setListStatus('ready')
      try {
        const counts: Record<string, number> = {}
        await Promise.all(
          listed.map(async m => {
            counts[m.id] = await getMatchRsvpCount(m.id)
          })
        )
        if (gen !== fetchGen.current) return
        setRsvpCounts(counts)
      } catch (countError) {
        console.error('Error fetching RSVP counts:', countError)
        if (gen !== fetchGen.current) return
        setRsvpCounts({})
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
      if (gen !== fetchGen.current) return
      setMatches([])
      setRsvpCounts({})
      setListStatus('error')
    }
  }

  useEffect(() => {
    if (authLoading || !userId || membershipsLoading) return

    const gen = ++fetchGen.current
    setListStatus('loading')
    setMatches([])
    setRsvpCounts({})

    void loadMatchesAndCounts(gen)
    return () => {
      // Invalidate in-flight work so unmount cannot overwrite the shared store.
      fetchGen.current++
    }
    // loadMatchesAndCounts closes over latest club/membership state each effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional gen-gated fetch
  }, [
    userId,
    authLoading,
    membershipsLoading,
    memberships,
    clubId,
    isSuperUser,
    setMatches,
  ])

  const refetchMatchesAndCounts = async () => {
    const gen = ++fetchGen.current
    setListStatus('loading')
    setMatches([])
    setRsvpCounts({})
    await loadMatchesAndCounts(gen)
  }

  const visibleMatches = useMemo(() => {
    if (!showAdminList) return matches
    return filterMatches(matches, filter)
  }, [matches, filter, showAdminList])

  const manageFlags = useMemo(() => {
    const flags: Record<string, boolean> = {}
    for (const match of matches) {
      flags[match.id] = canManageMatchClub({
        matchClubId: match.clubId,
        memberships,
        isSuperUser: !!isSuperUser,
      })
    }
    return flags
  }, [matches, memberships, isSuperUser])

  if (authLoading || membershipsLoading || listStatus === 'loading') {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!userId) {
    return null
  }

  if (listStatus === 'error') {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Could not load matches</CardTitle>
            <CardDescription>
              Something went wrong while fetching upcoming matches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => void refetchMatchesAndCounts()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 animate-slide-up-fade">
        <div className="flex items-center gap-3">
          <SoccerBallIcon className="h-10 w-10 animate-float text-red-50" />
          <div>
            <h1 className="text-3xl font-bold text-red-50">Matches</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {showAdminList
                ? 'Create matches and manage RSVPs, teams, and attendance'
                : 'View and RSVP to upcoming matches'}
            </p>
          </div>
        </div>
      </div>

      {canCreateMatch && (
        <div className="mb-6">
          <CreateMatchCard
            clubId={clubId}
            onMatchCreated={refetchMatchesAndCounts}
          />
        </div>
      )}

      {showAdminList ? (
        <div
          role="tablist"
          aria-label="Filter matches"
          className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          {ADMIN_FILTERS.map(option => {
            const active = filter === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {visibleMatches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Matches</CardTitle>
            <CardDescription>
              No matches have been created yet. Check back soon!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {showAdminList
                ? filter === 'past'
                  ? 'No past matches.'
                  : filter === 'upcoming'
                    ? 'No upcoming matches.'
                    : 'Create a match using the form above.'
                : 'Check back soon for upcoming matches!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            visibleMatches.length > 1 && 'sm:grid-cols-2',
            visibleMatches.length > 2 && 'lg:grid-cols-3'
          )}
        >
          {visibleMatches.map((match, index) =>
            showAdminList ? (
              <AdminMatchCard
                key={match.id}
                match={match}
                href={matchHref(match.id)}
                rsvpCount={rsvpCounts[match.id]}
                onDeleted={refetchMatchesAndCounts}
              />
            ) : (
              <MatchCard
                key={match.id}
                match={match}
                href={matchHref(match.id)}
                rsvpCount={rsvpCounts[match.id]}
                isAdmin={manageFlags[match.id] ?? false}
                index={index}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
