'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { DeleteMatchButton } from '@/components/admin/DeleteMatchButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchesList } from '@/components/matches/MatchesList'
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
import { useMyMatchRsvps } from '@/lib/hooks/useMyMatchRsvps'
import { listMatchesForViewer } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import {
  canCreateClubMatches,
  canManageMatchClub,
  filterMatchesForClubScope,
} from '@/lib/utils/clubMatches'
import { clubMatchPath } from '@/lib/utils/clubPaths'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'
import type { Match } from '@/types/match'

export type ClubMatchesViewProps = {
  /** Club to scope the list. `null` = all clubs (super_user legacy `/matches`). */
  clubId: string | null
  /**
   * Slug for match detail links. `null` with a club id uses legacy
   * `/matches/[id]`. All-clubs (`clubId` null) stays on `/admin/matches/[id]`
   * so Back returns to the cross-club list.
   */
  clubSlug: string | null
}

function resolveRsvpCount(match: Match): number | null {
  if (typeof match.rsvpConfirmedCount === 'number') {
    return match.rsvpConfirmedCount
  }
  return null
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
  const countsGen = useRef(0)

  const canCreateMatch =
    Boolean(clubId) &&
    canCreateClubMatches({
      memberships,
      activeClubId: clubId,
      isSuperUser: !!isSuperUser,
    })
  /** Super users and club admins also load past matches (Past filter). */
  const showAdminList = !!isSuperUser || canCreateMatch
  // Everyone gets "You're in" lines and the I'm in filter.
  const myRsvps = useMyMatchRsvps(userId, !authLoading && !membershipsLoading)

  const matchHref = (matchId: string) => {
    if (clubSlug) return clubMatchPath(clubSlug, matchId)
    if (!clubId) return `/admin/matches/${matchId}`
    return `/matches/${matchId}`
  }

  const loadCountsForMatches = async (matchesToCount: Match[], gen: number) => {
    if (matchesToCount.length === 0) return
    const next: Record<string, number> = {}
    await Promise.all(
      matchesToCount.map(async m => {
        const denormalized = resolveRsvpCount(m)
        if (denormalized != null) {
          next[m.id] = denormalized
          return
        }
        next[m.id] = await getMatchRsvpCount(m.id)
      })
    )
    if (gen !== countsGen.current) return
    setRsvpCounts(prev => ({ ...prev, ...next }))
  }

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
      // Admins keep past matches in memory for tabs; players only see upcoming.
      const listed = showAdminList
        ? scoped
        : scoped.filter(m => !isMatchPast(m.date, m.time))
      setMatches(listed)
      // Match list is usable without counts; do not fail the page if RSVP
      // queries error (e.g. missing composite index).
      setListStatus('ready')

      // Counts are shown for upcoming matches only (hero and "You're in"
      // lines). Prefer denormalized match fields.
      const initialForCounts = listed.filter(m => !isMatchPast(m.date, m.time))
      const countGen = ++countsGen.current
      const seeded: Record<string, number> = {}
      const needsFetch: Match[] = []
      for (const m of initialForCounts) {
        const denormalized = resolveRsvpCount(m)
        if (denormalized != null) seeded[m.id] = denormalized
        else needsFetch.push(m)
      }
      setRsvpCounts(seeded)
      if (needsFetch.length > 0) {
        try {
          await loadCountsForMatches(needsFetch, countGen)
        } catch (countError) {
          console.error('Error fetching RSVP counts:', countError)
        }
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
      countsGen.current++
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
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <PageHeader
        className="animate-slide-up-fade"
        eyebrow={clubId ? undefined : 'Super user'}
        title={clubId ? 'Matches' : 'All matches'}
        description={
          showAdminList
            ? 'Create matches and manage RSVPs, teams, and attendance'
            : 'View and RSVP to upcoming matches'
        }
      />

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
            <p className="text-sm text-muted-foreground">
              {canCreateMatch
                ? 'Create a match using the form above.'
                : 'Check back soon for upcoming matches!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <MatchesList
          matches={matches}
          rsvpCounts={rsvpCounts}
          hrefFor={matchHref}
          myRsvps={myRsvps}
          onRetryMyRsvps={() => void myRsvps.retry()}
          paginationScope={JSON.stringify([clubId, userId])}
          includePast={showAdminList}
          matchActions={match =>
            // Page-level admin lists can include unstamped matches a club
            // admin cannot delete; only offer Delete where they can.
            showAdminList && manageFlags[match.id] ? (
              <DeleteMatchButton
                match={match}
                onDeleted={refetchMatchesAndCounts}
              />
            ) : null
          }
        />
      )}
    </div>
  )
}
