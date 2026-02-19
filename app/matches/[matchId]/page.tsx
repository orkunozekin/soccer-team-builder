'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { useMatchStore } from '@/store/matchStore'
import { MatchDetails } from '@/components/matches/MatchDetails'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { BackLink } from '@/components/ui/back-link'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export default function MatchDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const { user, loading: authLoading } = useAuth()
  const { currentMatch, setCurrentMatch, matchRSVPs, setMatchRSVPs, setLoading } =
    useMatchStore()
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    const fetchMatchData = async () => {
      if (!matchId || !user) return

      setLoadingMatch(true)
      try {
        const match = await getMatch(matchId)
        if (!match) {
          router.push('/matches')
          return
        }

        setCurrentMatch(match)

        // Fetch RSVPs for this match
        const rsvps = await getMatchRSVPs(matchId)
        setMatchRSVPs(rsvps)

        const [matchTeams, users] = await Promise.all([
          getMatchTeams(matchId),
          getAllUsers(),
        ])
        setTeams(matchTeams)
        setAllUsers(users)
        setLoadingTeams(false)
      } catch (error) {
        console.error('Error fetching match data:', error)
        router.push('/matches')
      } finally {
        setLoadingMatch(false)
      }
    }

    fetchMatchData()
  }, [matchId, user, authLoading, router, setCurrentMatch, setMatchRSVPs])

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
        <div>
          <MatchDetails match={currentMatch} rsvpCount={matchRSVPs.length} onTeamsRegenerated={refetchTeams} />
        </div>

        <div>
          {!loadingTeams && teams.length > 0 && (
            <TeamsDisplay
              teams={teams}
              users={allUsers}
            />
          )}
        </div>
      </div>
    </div>
  )
}
