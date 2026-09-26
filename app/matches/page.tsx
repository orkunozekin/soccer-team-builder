'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { getAllMatches } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { cn } from '@/lib/utils'
import {
  canCreateClubMatches,
  canManageMatchClub,
  filterMatchesForClubScope,
} from '@/lib/utils/clubMatches'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'

export default function MatchesPage() {
  const router = useRouter()
  const { user, userData, loading: authLoading } = useAuth()
  const userId = user?.uid
  const { isAdmin: isSuperUser } = useAdmin()
  const {
    memberships,
    loading: membershipsLoading,
  } = useClubMemberships()
  const { matches, setMatches } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  // Local load state — do not use the shared store `loading` flag. Overlapping
  // navigations / admin pages flipping that flag made this page treat an
  // in-flight or failed fetch as a successful empty list.
  const [listStatus, setListStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const fetchGen = useRef(0)

  const canCreateMatch = canCreateClubMatches({
    memberships,
    isSuperUser: !!isSuperUser,
  })

  const hasActiveMembership = memberships.some(m => m.status === 'active')

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }
    if (authLoading || !userId || membershipsLoading) return

    const gen = ++fetchGen.current
    setListStatus('loading')

    const fetchMatches = async () => {
      try {
        const allMatches = await getAllMatches()
        if (gen !== fetchGen.current) return
        const scoped = filterMatchesForClubScope({
          matches: allMatches,
          memberships,
          activeClubId: userData?.activeClubId,
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
        setListStatus('error')
      }
    }

    fetchMatches()
  }, [
    userId,
    authLoading,
    membershipsLoading,
    memberships,
    userData?.activeClubId,
    isSuperUser,
    router,
    setMatches,
  ])

  const refetchMatchesAndCounts = async () => {
    const gen = ++fetchGen.current
    setListStatus('loading')
    try {
      const allMatches = await getAllMatches()
      if (gen !== fetchGen.current) return
      const scoped = filterMatchesForClubScope({
        matches: allMatches,
        memberships,
        activeClubId: userData?.activeClubId,
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

  if (listStatus === 'error' && matches.length === 0) {
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
            <Button type="button" onClick={() => void refetchMatchesAndCounts()}>
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

      {!hasActiveMembership && !isSuperUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Join a club</CardTitle>
            <CardDescription>
              You are not a member of any club yet. Enter an invite code to see
              that club&apos;s matches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/join">Enter invite code</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canCreateMatch && (
        <div className="mb-6">
          <CreateMatchCard onMatchCreated={refetchMatchesAndCounts} />
        </div>
      )}

      {matches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Matches</CardTitle>
            <CardDescription>
              {hasActiveMembership || isSuperUser
                ? 'No matches have been created yet. Check back soon!'
                : 'Join a club with an invite code to see upcoming matches.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {canCreateMatch
                ? 'Create a match using the form above.'
                : hasActiveMembership || isSuperUser
                  ? 'Check back soon for upcoming matches!'
                  : 'Ask a club admin for an invite link or code.'}
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
