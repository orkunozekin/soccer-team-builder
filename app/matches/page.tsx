'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { getAllMatches } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'
import { MatchCard } from '@/components/matches/MatchCard'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin } = useAdmin()
  const { matches, loading, setMatches, setLoading } = useMatchStore()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    const fetchMatches = async () => {
      if (user) {
        setLoading(true)
        try {
          const allMatches = await getAllMatches()
          setMatches(allMatches)
        } catch (error) {
          console.error('Error fetching matches:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    fetchMatches()
  }, [user, authLoading, router, setMatches, setLoading])

  if (authLoading || loading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Matches</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          View and RSVP to upcoming matches
        </p>
      </div>

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
                ? 'Create matches from the admin dashboard.'
                : 'Check back soon for upcoming matches!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}
