'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { useMatchStore } from '@/store/matchStore'
import { MatchDetails } from '@/components/matches/MatchDetails'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { EditMatchCard } from '@/components/admin/EditMatchCard'
import { RebalanceTeamsButton } from '@/components/admin/RebalanceTeamsButton'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { BackLink } from '@/components/ui/back-link'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export default function MatchDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const { user, loading: authLoading } = useAuth()
  const { isAdmin } = useAdmin()
  const { currentMatch, setCurrentMatch, matchRSVPs, setMatchRSVPs, setLoading } =
    useMatchStore()
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    const fetchMatchData = async () => {
      if (!matchId || !user) return

      setLoadingMatch(true)
      setFetchError(null)
      try {
        const match = await getMatch(matchId)
        if (!match) {
          router.push('/matches')
          return
        }

        setCurrentMatch(match)

        try {
          const rsvps = await getMatchRSVPs(matchId)
          setMatchRSVPs(rsvps)
        } catch {
          setFetchError('Failed to load RSVPs')
        }

        try {
          const [matchTeams, users] = await Promise.all([
            getMatchTeams(matchId),
            getAllUsers(),
          ])
          setTeams(matchTeams)
          setAllUsers(users)
        } catch {
          setFetchError('Failed to load teams or players')
        }
      } catch {
        setFetchError('Failed to load match')
        router.push('/matches')
        return
      } finally {
        setLoadingMatch(false)
        setLoadingTeams(false)
      }
    }

    fetchMatchData()
  }, [matchId, user, authLoading, router, setCurrentMatch, setMatchRSVPs])

  const refetchAll = async () => {
    if (!matchId) return
    try {
      const [matchData, rsvpsData, teamsData, usersData] = await Promise.all([
        getMatch(matchId),
        getMatchRSVPs(matchId),
        getMatchTeams(matchId),
        getAllUsers(),
      ])
      if (matchData) setCurrentMatch(matchData)
      setMatchRSVPs(rsvpsData)
      setTeams(teamsData)
      setAllUsers(usersData)
    } catch (e) {
      console.error('refetchAll failed:', e)
    }
  }

  const refetchTeams = async () => {
    if (!matchId) return
    const newTeams = await getMatchTeams(matchId)
    setTeams(newTeams)
  }

  if (authLoading || loadingMatch) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!user || !currentMatch) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-2">
      <BackLink href="/matches" label="Back to Matches" />

      <div className="mt-2 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          <MatchDetails match={currentMatch} rsvpCount={matchRSVPs.length} onTeamsRegenerated={refetchTeams} />

          {isAdmin && currentMatch && (
            <EditMatchCard
              matchId={matchId}
              match={currentMatch}
              onSaved={refetchAll}
              onDeleted={() => router.push('/matches')}
            />
          )}
        </div>

        <div className="space-y-6">
          {!loadingTeams && teams.length > 0 && (
            <TeamsDisplay
              matchId={matchId}
              teams={teams}
              users={allUsers}
              isAdmin={isAdmin ?? false}
              onTeamsChanged={refetchAll}
              headerActions={
                isAdmin && teams.length >= 2 ? (
                  <RebalanceTeamsButton
                    matchId={matchId}
                    onDone={refetchAll}
                    size="sm"
                    showError="inline"
                  />
                ) : null
              }
            />
          )}
          {isAdmin && teams.length > 0 && (
            <PlayerTransfer
              matchId={matchId}
              teams={teams}
              users={allUsers}
              onTransferComplete={refetchAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}
