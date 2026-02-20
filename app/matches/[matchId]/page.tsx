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
        } catch (e) {
          console.error('getMatchRSVPs failed:', e)
          setFetchError(`RSVPs: ${e instanceof Error ? e.message : String(e)}`)
        }

        try {
          const [matchTeams, users] = await Promise.all([
            getMatchTeams(matchId),
            getAllUsers(),
          ])
          setTeams(matchTeams)
          setAllUsers(users)
        } catch (e) {
          console.error('getMatchTeams or getAllUsers failed:', e)
          setFetchError(`Teams/Users: ${e instanceof Error ? e.message : String(e)}`)
        }
      } catch (error) {
        console.error('getMatch failed:', error)
        setFetchError(`Match: ${error instanceof Error ? error.message : String(error)}`)
        router.push('/matches')
        return
      } finally {
        setLoadingMatch(false)
        setLoadingTeams(false)
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
