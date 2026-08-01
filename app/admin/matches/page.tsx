'use client'

import { useEffect, useState } from 'react'
import { AdminMatchCard } from '@/components/admin/AdminMatchCard'
import { AdminNav } from '@/components/admin/AdminNav'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'
import { Card, CardContent } from '@/components/ui/card'
import { getAllMatches } from '@/lib/services/matchService'
import { getMatchRsvpCount } from '@/lib/services/rsvpService'
import { useMatchStore } from '@/store/matchStore'

export default function AdminMatchesPage() {
  const { matches, setMatches, setLoading } = useMatchStore()
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})

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
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            All matches
          </h2>
          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  No matches created yet. Create one above.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map(match => (
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
