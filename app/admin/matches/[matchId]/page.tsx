'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { getMatch } from '@/lib/services/matchService'
import { getMatchTeams, getBench } from '@/lib/services/teamService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getAllUsers } from '@/lib/services/userService'
import { generateTeamsAPI, deleteMatchAPI } from '@/lib/api/client'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import Link from 'next/link'
import { GenerateTeamsButton } from '@/components/admin/GenerateTeamsButton'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Match } from '@/types/match'
import { Team } from '@/types/team'
import { User } from '@/types/user'

function AdminMatchManagementContent() {
  const router = useRouter()
  const params = useParams()
  const { isSuperAdmin } = useAdmin()
  const matchId = params?.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [benchPlayerIds, setBenchPlayerIds] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const autoGenerateAttempted = useRef(false)

  const refreshData = async () => {
    if (!matchId) return

    try {
      const [matchData, teamsData, benchData, usersData] = await Promise.all([
        getMatch(matchId),
        getMatchTeams(matchId),
        getBench(matchId),
        getAllUsers(),
      ])

      setMatch(matchData)
      setTeams(teamsData)
      setBenchPlayerIds(benchData?.playerIds || [])
      setAllUsers(usersData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!matchId) return
    refreshData()
  }, [matchId])

  // Auto-generate teams once when 2+ RSVPs and no teams yet
  useEffect(() => {
    if (!mounted || loading || !matchId || teams.length > 0 || autoGenerateAttempted.current) return

    let cancelled = false
    autoGenerateAttempted.current = true

    getMatchRSVPs(matchId).then((rsvps) => {
      if (cancelled || rsvps.length < 2) return
      generateTeamsAPI(matchId)
        .then(() => {
          if (!cancelled) refreshData()
        })
        .catch(() => {
          autoGenerateAttempted.current = false
        })
    })

    return () => {
      cancelled = true
    }
  }, [mounted, loading, matchId, teams.length])

  if (!mounted || loading) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  const handleDeleteMatch = async () => {
    if (!matchId || !confirm('Delete this match? This will remove the match, its teams, bench, and RSVPs. This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteMatchAPI(matchId)
      router.push('/admin')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Match not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/admin')}
        className="mb-6 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        ← Back to Admin Dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Match Management</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage match settings, teams, and RSVP polls
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Match settings</CardTitle>
                <CardDescription>
                  Edit or delete this match. Only super admins see this.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link href={`/admin/matches/${matchId}/edit`}>
                  <Button variant="outline">
                    Edit match
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDeleteMatch}
                >
                  {deleting ? 'Deleting...' : 'Delete match'}
                </Button>
              </CardContent>
            </Card>
          )}
          <RSVPPollControls match={match} />
          <GenerateTeamsButton match={match} onTeamsGenerated={refreshData} />
          <PlayerTransfer
            matchId={matchId}
            teams={teams}
            users={allUsers}
            benchPlayerIds={benchPlayerIds}
            onTransferComplete={refreshData}
          />
        </div>

        <div>
          {teams.length > 0 && (
            <TeamsDisplay
              teams={teams}
              users={allUsers}
              benchPlayerIds={benchPlayerIds}
              isAdmin={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminMatchPage() {
  return (
    <AdminRouteGuard>
      <AdminMatchManagementContent />
    </AdminRouteGuard>
  )
}
