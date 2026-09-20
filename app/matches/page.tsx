'use client'

import { useEffect, useRef, useState } from 'react'
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
import { getAllMatches } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { cn } from '@/lib/utils'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.uid
  const { isAdmin } = useAdmin()
  const { matches, setMatches } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  // Local load state — do not use the shared store `loading` flag. Overlapping
  // navigations / admin pages flipping that flag made this page treat an
  // in-flight or failed fetch as a successful empty list.
  const [listStatus, setListStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const fetchGen = useRef(0)

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }
    if (authLoading || !userId) return

    const gen = ++fetchGen.current
    setListStatus('loading')

    const fetchMatches = async () => {
      try {
        const allMatches = await getAllMatches()
        if (gen !== fetchGen.current) return
        const upcoming = allMatches.filter(m => !isMatchPast(m.date, m.time))
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
  }, [userId, authLoading, router, setMatches])

  const refetchMatchesAndCounts = async () => {
    const gen = ++fetchGen.current
    setListStatus('loading')
    try {
      const allMatches = await getAllMatches()
      if (gen !== fetchGen.current) return
      const upcoming = allMatches.filter(m => !isMatchPast(m.date, m.time))
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

  if (authLoading || listStatus === 'loading') {
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

      {isAdmin && (
        <div className="mb-6">
          <CreateMatchCard onMatchCreated={refetchMatchesAndCounts} />
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
              {isAdmin
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
              rsvpCount={rsvpCounts[match.id]}
              isAdmin={isAdmin ?? false}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  )
}
