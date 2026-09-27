'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchCard } from '@/components/matches/MatchCard'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { listMatchesForViewer } from '@/lib/services/matchService'
import { cn } from '@/lib/utils'
import {
  canCreateClubMatches,
  canManageMatchClub,
  filterMatchesForClubScope,
} from '@/lib/utils/clubMatches'
import { clubMatchPath } from '@/lib/utils/clubPaths'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'

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
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  )
  const fetchGen = useRef(0)

  const canCreateMatch = canCreateClubMatches({
    memberships,
    activeClubId: clubId,
    isSuperUser: !!isSuperUser,
  })

  const matchHref = (matchId: string) =>
    clubSlug ? clubMatchPath(clubSlug, matchId) : `/matches/${matchId}`

  useEffect(() => {
    if (authLoading || !userId || membershipsLoading) return

    const gen = ++fetchGen.current
    setListStatus('loading')
    setMatches([])
    setRsvpCounts({})

    const fetchMatches = async () => {
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
        const upcoming = scoped.filter(m => !isMatchPast(m.date, m.time))
        setMatches(upcoming)
        const counts: Record<string, number> = {}
        await Promise.all(
          upcoming.map(async m => {
            counts[m.id] = await getMatchRsvpCount(m.id)
          })
        )
        if (gen !== fetchGen.current) return
        setRsvpCounts(counts)
        setListStatus('ready')
      } catch (error) {
        console.error('Error fetching matches:', error)
        if (gen !== fetchGen.current) return
        setMatches([])
        setRsvpCounts({})
        setListStatus('error')
      }
    }

    void fetchMatches()
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
      const upcoming = scoped.filter(m => !isMatchPast(m.date, m.time))
      setMatches(upcoming)
      const counts: Record<string, number> = {}
      await Promise.all(
        upcoming.map(async m => {
          counts[m.id] = await getMatchRsvpCount(m.id)
        })
      )
      if (gen !== fetchGen.current) return
      setRsvpCounts(counts)
      setListStatus('ready')
    } catch (error) {
      console.error('Error fetching matches:', error)
      if (gen !== fetchGen.current) return
      setMatches([])
      setRsvpCounts({})
      setListStatus('error')
    }
  }

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
              View and RSVP to upcoming matches
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

      {matches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Matches</CardTitle>
            <CardDescription>
              No matches have been created yet. Check back soon!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {canCreateMatch
                ? 'Create a match using the form above.'
                : 'Check back soon for upcoming matches!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            matches.length > 1 && 'sm:grid-cols-2',
            matches.length > 2 && 'lg:grid-cols-3'
          )}
        >
          {matches.map((match, index) => (
            <MatchCard
              key={match.id}
              match={match}
              href={matchHref(match.id)}
              rsvpCount={rsvpCounts[match.id]}
              isAdmin={manageFlags[match.id] ?? false}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  )
}
