'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminMatchCard } from '@/components/admin/AdminMatchCard'
import { AdminNav } from '@/components/admin/AdminNav'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAllMatches } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { cn } from '@/lib/utils'
import {
  filterMatches,
  type MatchFilter,
} from '@/lib/utils/adminMatchFilters'
import { useMatchStore } from '@/store/matchStore'

const FILTERS: { value: MatchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

export default function AdminMatchesPage() {
  const { matches, setMatches } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<MatchFilter>('upcoming')
  const [listStatus, setListStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const fetchGen = useRef(0)

  useEffect(() => {
    const gen = ++fetchGen.current
    setListStatus('loading')

    const fetchMatches = async () => {
      try {
        const allMatches = await getAllMatches()
        if (gen !== fetchGen.current) return
        setMatches(allMatches)
        const counts: Record<string, number> = {}
        await Promise.all(
          allMatches.map(async m => {
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
  }, [setMatches])

  const refetchMatches = async () => {
    const gen = ++fetchGen.current
    setListStatus('loading')
    try {
      const allMatches = await getAllMatches()
      if (gen !== fetchGen.current) return
      setMatches(allMatches)
      const counts: Record<string, number> = {}
      await Promise.all(
        allMatches.map(async m => {
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

  if (listStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <AdminNav />
        <PageLoadingSkeleton variant="container" />
      </div>
    )
  }

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

          {listStatus === 'error' && matches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  Could not load matches.
                </p>
                <Button type="button" onClick={() => void refetchMatches()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : visibleMatches.length === 0 ? (
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
