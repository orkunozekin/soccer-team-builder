'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminMatchCard } from '@/components/admin/AdminMatchCard'
import { AdminNav } from '@/components/admin/AdminNav'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { Card, CardContent } from '@/components/ui/card'
import { getAllMatches } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { cn } from '@/lib/utils'
import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import { useMatchStore } from '@/store/matchStore'
import type { Match } from '@/types/match'

type MatchFilter = 'all' | 'upcoming' | 'past'

const FILTERS: { value: MatchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

function filterMatches(matches: Match[], filter: MatchFilter): Match[] {
  if (filter === 'all') return matches
  if (filter === 'past') {
    return matches.filter(m => isMatchPast(m.date, m.time))
  }
  return matches.filter(m => !isMatchPast(m.date, m.time))
}

export default function AdminMatchesPage() {
  const { matches, setMatches, setLoading } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<MatchFilter>('all')

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true)
      try {
        const allMatches = await getAllMatches()
        setMatches(allMatches)
        const counts: Record<string, number> = {}
        await Promise.all(
          allMatches.map(async m => {
            counts[m.id] = await getMatchRsvpCount(m.id)
          })
        )
        setRsvpCounts(counts)
      } catch (error) {
        console.error('Error fetching matches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMatches()
  }, [setMatches, setLoading])

  const refetchMatches = async () => {
    const allMatches = await getAllMatches()
    setMatches(allMatches)
    const counts: Record<string, number> = {}
    await Promise.all(
      allMatches.map(async m => {
        counts[m.id] = await getMatchRsvpCount(m.id)
      })
    )
    setRsvpCounts(counts)
  }

  const visibleMatches = useMemo(
    () => filterMatches(matches, filter),
    [matches, filter]
  )

  const emptyMessage =
    matches.length === 0
      ? 'No matches created yet. Create one above.'
      : filter === 'upcoming'
        ? 'No upcoming matches.'
        : filter === 'past'
          ? 'No past matches.'
          : 'No matches created yet. Create one above.'

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Matches
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Create matches and manage RSVPs, teams, and attendance
        </p>
      </div>

      <div className="space-y-6">
        <CreateMatchCard onMatchCreated={refetchMatches} />

        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Matches
            </h2>
            <div
              role="tablist"
              aria-label="Filter matches"
              className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {FILTERS.map(option => {
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
          </div>

          {visibleMatches.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  {emptyMessage}
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
              {visibleMatches.map(match => (
                <AdminMatchCard
                  key={match.id}
                  match={match}
                  rsvpCount={rsvpCounts[match.id]}
                  onDeleted={refetchMatches}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
