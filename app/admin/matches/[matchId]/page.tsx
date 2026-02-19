'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { getMatch } from '@/lib/services/matchService'
import { getMatchTeams, getBench } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import { GenerateTeamsButton } from '@/components/admin/GenerateTeamsButton'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { Match } from '@/types/match'
import { Team } from '@/types/team'
import { User } from '@/types/user'

function AdminMatchManagementContent() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const { user } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [benchPlayerIds, setBenchPlayerIds] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

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
    refreshData()
  }, [matchId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    )
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
