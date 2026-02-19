'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { AdminMatchControls } from '@/components/admin/AdminMatchControls'
import { UserRoleManager } from '@/components/admin/UserRoleManager'
import { getAllMatches } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'
import { MatchCard } from '@/components/matches/MatchCard'
import { format } from 'date-fns'

function AdminDashboardContent() {
  const { role, isSuperAdmin } = useAdmin()
  const { matches, setMatches, setLoading } = useMatchStore()

  useEffect(() => {
    const fetchMatches = async () => {
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

    fetchMatches()
  }, [setMatches, setLoading])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage matches, teams, and RSVP polls
        </p>
      </div>

      <div className="space-y-6">
        <AdminMatchControls
          onMatchCreated={() => {
            // Refresh matches list
            getAllMatches().then(setMatches)
          }}
        />

        <div>
          <h2 className="text-2xl font-bold mb-4">All Matches</h2>
          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  No matches created yet. Create one above!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <Link key={match.id} href={`/admin/matches/${match.id}`}>
                  <Card className="transition-all hover:shadow-md cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {format(match.date, 'MMM d, yyyy')}
                      </CardTitle>
                      <CardDescription>
                        {format(match.date, 'h:mm a')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Click to manage
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mt-6">
          <UserRoleManager />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Role:</span> {role}
            </p>
            {isSuperAdmin && (
              <p className="text-zinc-600 dark:text-zinc-400">
                You have super admin privileges
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminDashboardContent />
    </AdminRouteGuard>
  )
}
