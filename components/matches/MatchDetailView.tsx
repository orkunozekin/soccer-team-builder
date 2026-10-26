'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useIsClubAdmin } from '@/lib/hooks/useClubMemberships'
import { useAuth } from '@/lib/hooks/useAuth'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams } from '@/lib/services/teamService'
import { getUsersByIds } from '@/lib/services/userService'
import { hasCheckInWindowStarted } from '@/lib/utils/checkIn'
import {
  buildRosterPlaceholders,
  collectMatchParticipantIds,
  mergeRosterProfiles,
} from '@/lib/utils/matchParticipants'
import { useMatchStore } from '@/store/matchStore'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export interface MatchDetailViewProps {
  /** Used for the back link and for redirects (e.g. match not found, match deleted). */
  backLink: { href: string; label: string }
  /**
   * When set, the loaded match must belong to this club (or have no clubId for
   * pre-backfill docs). Mismatched club → treat as not found.
   */
  expectedClubId?: string | null
}

function paramToString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
    return value[0]
  }
  return undefined
}

/**
 * Shared match detail UI used by both /matches/[matchId] and /admin/matches/[matchId].
 * Caller must ensure user is authenticated (and admin for admin route).
 */
export function MatchDetailView({
  backLink,
  expectedClubId,
}: MatchDetailViewProps) {
  const router = useRouter()
  const params = useParams()
  const matchId = paramToString(params?.matchId)
  const { user, userData } = useAuth()
  const userId = user?.uid
  const { currentMatch, setCurrentMatch, matchRSVPs, setMatchRSVPs } =
    useMatchStore()
  const match =
    currentMatch && matchId && currentMatch.id === matchId ? currentMatch : null
  // Super users and club_admins for this match's club; not global isAdmin alone.
  const {
    isClubAdmin: canManageMatch,
    error: clubPermissionError,
    refresh: refreshClubPermissions,
  } = useIsClubAdmin(match?.clubId)
  const userRsvp = userId
    ? (matchRSVPs.find(r => r.userId === userId) ?? null)
    : null
  const userProfilePosition = userData?.position ?? null
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [rosterUsers, setRosterUsers] = useState<User[]>([])
  const fetchGen = useRef(0)
  const refetchGen = useRef(0)
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
    if (!matchId || !userId) return

    const gen = ++fetchGen.current
    // Cancel in-flight manual refetches when the route/auth load restarts.
    refetchGen.current += 1
    setLoadingMatch(true)
    setTeams([])
    setRosterUsers([])
    // Clear RSVPs only while the full-page skeleton is showing so we never
    // paint "0 confirmed" / missing teams for a match that still has data.
    setMatchRSVPs([])

    const fetchMatchData = async () => {
      try {
        const nextMatch = await getMatch(matchId)
        if (gen !== fetchGen.current) return
        if (!nextMatch) {
          router.push(backLink.href)
          return
        }

        const matchClub =
          typeof nextMatch.clubId === 'string' ? nextMatch.clubId.trim() : ''
        const expected =
          typeof expectedClubId === 'string' ? expectedClubId.trim() : ''
        if (expected && matchClub && matchClub !== expected) {
          router.push(backLink.href)
          return
        }

        setCurrentMatch(nextMatch)

        try {
          const [matchTeams, rsvps] = await Promise.all([
            getMatchTeams(matchId),
            getMatchRSVPs(matchId),
          ])
          if (gen !== fetchGen.current) return
          setTeams(matchTeams)
          setMatchRSVPs(rsvps)

          const participantIds = collectMatchParticipantIds(matchTeams, rsvps)
          // Placeholders keep pitch/list populated even if profile docs lag
          // or a later refetch cancels hydration mid-flight.
          const placeholders = buildRosterPlaceholders(participantIds, rsvps)
          setRosterUsers(placeholders)
          setLoadingMatch(false)

          const profiles = await getUsersByIds(participantIds)
          if (gen !== fetchGen.current) return
          setRosterUsers(mergeRosterProfiles(placeholders, profiles))
        } catch {
          if (gen !== fetchGen.current) return
          console.error('Failed to load teams or players')
          setLoadingMatch(false)
        }
      } catch {
        if (gen !== fetchGen.current) return
        console.error('Failed to load match')
        router.push(backLink.href)
      } finally {
        if (gen === fetchGen.current) {
          setLoadingMatch(false)
        }
      }
    }

    fetchMatchData()
  }, [
    matchId,
    userId,
    router,
    backLink.href,
    expectedClubId,
    setCurrentMatch,
    setMatchRSVPs,
  ])

  const refetchMatchRoster = async () => {
    if (!matchId) return
    // Do not bump fetchGen here — that cancelled in-flight profile hydration
    // and left the pitch with an empty users array after teams had already
    // been shown.
    const gen = ++refetchGen.current
    try {
      const [matchData, rsvpsData, teamsData] = await Promise.all([
        getMatch(matchId),
        getMatchRSVPs(matchId),
        getMatchTeams(matchId),
      ])
      if (gen !== refetchGen.current) return
      if (matchData) setCurrentMatch(matchData)
      setMatchRSVPs(rsvpsData)
      setTeams(teamsData)
      const participantIds = collectMatchParticipantIds(teamsData, rsvpsData)
      const placeholders = buildRosterPlaceholders(participantIds, rsvpsData)
      setRosterUsers(placeholders)
      const usersData = await getUsersByIds(participantIds)
      if (gen !== refetchGen.current) return
      setRosterUsers(mergeRosterProfiles(placeholders, usersData))
    } catch (e) {
      console.error('refetchMatchRoster failed:', e)
    }
  }

  if (loadingMatch || !matchId || !match) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!userId) {
    return null
  }

  const hasTeamsPanel = teams.length > 0
  const confirmedRsvps = matchRSVPs.filter(r => r.status === 'confirmed')
  const checkedInCount = confirmedRsvps.filter(r => r.attended === true).length
  const showCheckInHeadcount = hasCheckInWindowStarted(match.date, match.time)

  return (
    <div className="flex w-full min-w-0 flex-col items-center overflow-x-clip">
      <div
        className={`mx-auto w-full min-w-0 px-4 pb-2 pt-6 ${
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
              match={match}
              rsvpCount={confirmedRsvps.length}
              checkedInCount={checkedInCount}
              showCheckInHeadcount={showCheckInHeadcount}
              userRsvp={userRsvp}
              userProfilePosition={userProfilePosition}
              onTeamsRegenerated={refetchMatchRoster}
              onMatchRefetch={refetchMatchRoster}
              teams={teams}
              rosterUsers={usersWithMatchPosition}
              currentUserId={userId}
            />

            {match.clubId && clubPermissionError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
              >
                <p>
                  We couldn&apos;t verify your club permissions. Match
                  management controls may be unavailable until this reloads.
                </p>
                <button
                  type="button"
                  onClick={() => void refreshClubPermissions()}
                  className="mt-2 font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {canManageMatch && (
              <>
                <EditMatchCard
                  matchId={matchId}
                  match={match}
                  onSaved={refetchMatchRoster}
                  onDeleted={() => router.push(backLink.href)}
                />
                <ImpersonateRSVP
                  match={match}
                  matchRSVPs={matchRSVPs}
                  onDone={refetchMatchRoster}
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
                isAdmin={canManageMatch}
                onTeamsChanged={refetchMatchRoster}
                currentUserId={userId}
                matchRSVPs={matchRSVPs}
                matchDate={match.date}
                matchTime={match.time}
                selectedFormation={match.selectedFormation}
                headerActions={
                  canManageMatch && teams.length >= 2 ? (
                    <RebalanceTeamsButton
                      matchId={matchId}
                      onDone={refetchMatchRoster}
                      size="sm"
                      showError="inline"
                    />
                  ) : null
                }
              />
              {canManageMatch && (
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

        {canManageMatch && matchId && (
          <div className="mt-4">
            <RsvpOrderCard
              matchId={matchId}
              matchRSVPs={matchRSVPs}
              users={rosterUsers}
              onRestoreComplete={refetchMatchRoster}
            />
          </div>
        )}
      </div>
    </div>
  )
}
