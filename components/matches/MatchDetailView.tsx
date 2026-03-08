'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EditMatchCard } from '@/components/admin/EditMatchCard'
import { ImpersonateRSVP } from '@/components/admin/ImpersonateRSVP'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { RebalanceTeamsButton } from '@/components/admin/RebalanceTeamsButton'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchDetails } from '@/components/matches/MatchDetails'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { BackLink } from '@/components/ui/back-link'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { useMatchStore } from '@/store/matchStore'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export interface MatchDetailViewProps {
  /** Used for the back link and for redirects (e.g. match not found, match deleted). */
  backLink: { href: string; label: string }
}

/**
 * Shared match detail UI used by both /matches/[matchId] and /admin/matches/[matchId].
 * Caller must ensure user is authenticated (and admin for admin route).
 */
export function MatchDetailView({ backLink }: MatchDetailViewProps) {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const { user, userData } = useAuth()
  const { isAdmin } = useAdmin()
  const { currentMatch, setCurrentMatch, matchRSVPs, setMatchRSVPs } =
    useMatchStore()
  const userRsvp = user
    ? (matchRSVPs.find(r => r.userId === user.uid) ?? null)
    : null
  const userProfilePosition = userData?.position ?? null
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const usersWithMatchPosition = useMemo(
    () =>
      allUsers.map(u => {
        const rsvp = matchRSVPs.find(r => r.userId === u.uid)
        return { ...u, position: rsvp?.position ?? u.position ?? null }
      }),
    [allUsers, matchRSVPs]
  )

  useEffect(() => {
    const fetchMatchData = async () => {
      if (!matchId || !user) return

      setLoadingMatch(true)
      try {
        const match = await getMatch(matchId)
        if (!match) {
          router.push(backLink.href)
          return
        }

        setCurrentMatch(match)

        try {
          const rsvps = await getMatchRSVPs(matchId)
          setMatchRSVPs(rsvps)
        } catch {
          console.error('Failed to load RSVPs')
        }

        try {
          const [matchTeams, users] = await Promise.all([
            getMatchTeams(matchId),
            getAllUsers(),
          ])
          setTeams(matchTeams)
          setAllUsers(users)
        } catch {
          console.error('Failed to load teams or players')
        }
      } catch {
        console.error('Failed to load match')
        router.push(backLink.href)
        return
      } finally {
        setLoadingMatch(false)
        setLoadingTeams(false)
      }
    }

    fetchMatchData()
  }, [matchId, user, router, backLink.href, setCurrentMatch, setMatchRSVPs])

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

  if (loadingMatch) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!user || !currentMatch) {
    return null
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center overflow-x-hidden">
      <div className="container mx-auto w-full min-w-0 max-w-full px-4 py-2">
        <BackLink href={backLink.href} label={backLink.label} />

        <div className="mt-2 grid min-w-0 gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0 space-y-6">
            <MatchDetails
              match={currentMatch}
              rsvpCount={matchRSVPs.length}
              userRsvp={userRsvp}
              userProfilePosition={userProfilePosition}
              onTeamsRegenerated={refetchTeams}
              onMatchRefetch={refetchAll}
            />

            {isAdmin && currentMatch && (
              <>
                <EditMatchCard
                  matchId={matchId}
                  match={currentMatch}
                  onSaved={refetchAll}
                  onDeleted={() => router.push(backLink.href)}
                />
                <ImpersonateRSVP
                  match={currentMatch}
                  matchRSVPs={matchRSVPs}
                  onDone={refetchAll}
                />
              </>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            {!loadingTeams && teams.length > 0 && (
              <TeamsDisplay
                matchId={matchId}
                teams={teams}
                users={usersWithMatchPosition}
                isAdmin={isAdmin ?? false}
                onTeamsChanged={refetchAll}
                currentUserId={user.uid}
                matchRSVPs={matchRSVPs}
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
                users={usersWithMatchPosition}
                onTransferComplete={refetchAll}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
