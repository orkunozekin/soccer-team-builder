'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams, getBench } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { useMatchStore } from '@/store/matchStore'
import { MatchDetails } from '@/components/matches/MatchDetails'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
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
  const [benchPlayerIds, setBenchPlayerIds] = useState<string[]>([])
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

        // Fetch teams and bench
        const [matchTeams, bench, users] = await Promise.all([
          getMatchTeams(matchId),
          getBench(matchId),
          getAllUsers(),
        ])
        setTeams(matchTeams)
        setBenchPlayerIds(bench?.playerIds || [])
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

  if (authLoading || loadingMatch) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading match details...</p>
        </div>
      </div>
    )
  }

  if (!user || !currentMatch) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/matches')}
        className="mb-6 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        ← Back to Matches
      </button>

      <MatchDetails match={currentMatch} rsvpCount={matchRSVPs.length} />

      {!loadingTeams && teams.length > 0 && (
        <div className="mt-8">
          <TeamsDisplay
            teams={teams}
            users={allUsers}
            benchPlayerIds={benchPlayerIds}
          />
        </div>
      )}
    </div>
  )
}
