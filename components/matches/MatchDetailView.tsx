'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { EditMatchCard } from '@/components/admin/EditMatchCard'
import { ImpersonateRSVP } from '@/components/admin/ImpersonateRSVP'
import { RsvpOrderCard } from '@/components/admin/RsvpOrderCard'
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
import { getUsersByIds } from '@/lib/services/userService'
import { hasCheckInWindowStarted } from '@/lib/utils/checkIn'
import { collectMatchParticipantIds } from '@/lib/utils/matchParticipants'
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
  const [rosterUsers, setRosterUsers] = useState<User[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const usersWithMatchPosition = useMemo(() => {
    const rsvpByUserId = new Map(matchRSVPs.map(r => [r.userId, r]))
    return rosterUsers.map(u => {
      const rsvp = rsvpByUserId.get(u.uid)
      const jerseyFromRsvp = rsvp?.jerseyNumber ?? null
      const jerseyFromProfile = u.jerseyNumber ?? null
      return {
        ...u,
        position: rsvp?.position ?? u.position ?? null,
        jerseyNumber:
          jerseyFromRsvp != null ? jerseyFromRsvp : jerseyFromProfile,
      }
    })
  }, [rosterUsers, matchRSVPs])

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
          const [matchTeams, rsvps] = await Promise.all([
            getMatchTeams(matchId),
            getMatchRSVPs(matchId),
          ])
          setTeams(matchTeams)
          setMatchRSVPs(rsvps)
          const users = await getUsersByIds(
            collectMatchParticipantIds(matchTeams, rsvps)
          )
          setRosterUsers(users)
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

  const refetchMatchRoster = async () => {
    if (!matchId) return
    try {
      const [matchData, rsvpsData, teamsData] = await Promise.all([
        getMatch(matchId),
        getMatchRSVPs(matchId),
        getMatchTeams(matchId),
      ])
      if (matchData) setCurrentMatch(matchData)
      setMatchRSVPs(rsvpsData)
      setTeams(teamsData)
      const usersData = await getUsersByIds(
        collectMatchParticipantIds(teamsData, rsvpsData)
      )
      setRosterUsers(usersData)
    } catch (e) {
      console.error('refetchMatchRoster failed:', e)
    }
  }

  if (loadingMatch) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!user || !currentMatch) {
    return null
  }

  const hasTeamsPanel = !loadingTeams && teams.length > 0
  const confirmedRsvps = matchRSVPs.filter(r => r.status === 'confirmed')
  const checkedInCount = confirmedRsvps.filter(r => r.attended === true).length
  const showCheckInHeadcount = hasCheckInWindowStarted(
    currentMatch.date,
    currentMatch.time
  )

  return (
    <div className="flex w-full min-w-0 flex-col items-center overflow-x-hidden">
      <div
        className={`mx-auto w-full min-w-0 px-4 py-2 ${
          hasTeamsPanel ? 'max-w-6xl' : 'max-w-xl'
        }`}
      >
        <BackLink href={backLink.href} label={backLink.label} />

        <div
          className={`mt-2 grid min-w-0 gap-10 ${
            hasTeamsPanel ? 'lg:grid-cols-2 lg:gap-12' : ''
          }`}
        >
          <div className="min-w-0 space-y-6">
            <MatchDetails
              match={currentMatch}
              rsvpCount={confirmedRsvps.length}
              checkedInCount={checkedInCount}
              showCheckInHeadcount={showCheckInHeadcount}
              userRsvp={userRsvp}
              userProfilePosition={userProfilePosition}
              onTeamsRegenerated={refetchMatchRoster}
              onMatchRefetch={refetchMatchRoster}
            />

            {isAdmin && currentMatch && (
              <>
                <EditMatchCard
                  matchId={matchId}
                  match={currentMatch}
                  onSaved={refetchMatchRoster}
                  onDeleted={() => router.push(backLink.href)}
                />
                <ImpersonateRSVP
                  match={currentMatch}
                  matchRSVPs={matchRSVPs}
                  onDone={refetchMatchRoster}
                />
                <RsvpOrderCard
                  matchRSVPs={matchRSVPs}
                  users={rosterUsers}
                />
              </>
            )}
          </div>

          {hasTeamsPanel && (
            <div className="min-w-0 space-y-6">
              <TeamsDisplay
                matchId={matchId}
                teams={teams}
                users={usersWithMatchPosition}
                isAdmin={isAdmin ?? false}
                onTeamsChanged={refetchMatchRoster}
                currentUserId={user.uid}
                matchRSVPs={matchRSVPs}
                matchDate={currentMatch.date}
                matchTime={currentMatch.time}
                headerActions={
                  isAdmin && teams.length >= 2 ? (
                    <RebalanceTeamsButton
                      matchId={matchId}
                      onDone={refetchMatchRoster}
                      size="sm"
                      showError="inline"
                    />
                  ) : null
                }
              />
              {isAdmin && (
                <PlayerTransfer
                  matchId={matchId}
                  teams={teams}
                  users={usersWithMatchPosition}
                  onTransferComplete={refetchMatchRoster}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
