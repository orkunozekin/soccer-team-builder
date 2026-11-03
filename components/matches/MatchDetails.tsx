'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckInButton } from '@/components/matches/CheckInButton'
import { LocationLink } from '@/components/matches/LocationLink'
import { RosterFillMeter } from '@/components/matches/RosterFillMeter'
import { RSVPButton } from '@/components/matches/RSVPButton'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { updateRSVPPositionAPI } from '@/lib/api/client'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import { cn } from '@/lib/utils'
import {
  getKickoffLabelForMatch,
  getRsvpStatusForMatch,
} from '@/lib/utils/matchStatus'
import { getTeamPositionOccupancy } from '@/lib/utils/pitchLayout'
import { hasMatchStarted } from '@/lib/utils/rsvpScheduler'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { useMatchStore } from '@/store/matchStore'
import { Match } from '@/types/match'
import { RSVP } from '@/types/rsvp'
import { Team } from '@/types/team'
import { User } from '@/types/user'

interface MatchDetailsProps {
  match: Match
  rsvpCount: number
  /** Confirmed RSVPs who have checked in; used when showCheckInHeadcount is true */
  checkedInCount?: number
  /** When true, headcount reads as "X of Y checked in" */
  showCheckInHeadcount?: boolean
  userRsvp: RSVP | null
  userProfilePosition: string | null
  onTeamsRegenerated?: () => void | Promise<void>
  onMatchRefetch?: () => void | Promise<void>
  /** Teams + roster users for team-aware position occupancy cues */
  teams?: Team[]
  rosterUsers?: User[]
  currentUserId?: string | null
  /**
   * Past match viewed by someone who cannot manage it: RSVP and position
   * controls are disabled (the RSVP API enforces the same rule).
   */
  readOnly?: boolean
}

function positionLabel(value: string | null): string {
  if (!value) return 'None'
  const p = SOCCER_POSITIONS.find(x => x.value === value)
  return p ? p.label : value
}

export function MatchDetails({
  match,
  rsvpCount,
  checkedInCount = 0,
  showCheckInHeadcount = false,
  userRsvp,
  userProfilePosition,
  onTeamsRegenerated,
  onMatchRefetch,
  teams = [],
  rosterUsers = [],
  currentUserId = null,
  readOnly = false,
}: MatchDetailsProps) {
  const matchDate = new Date(match.date)
  const formattedTime = format(matchDate, 'h:mm a')
  const rsvpStatus = getRsvpStatusForMatch(match)

  const { updateRSVPPosition } = useMatchStore()
  const currentPosition = userRsvp?.position ?? userProfilePosition ?? null

  const userTeam = currentUserId
    ? teams.find(t => t.playerIds.includes(currentUserId))
    : undefined
  const positionOccupancy = getTeamPositionOccupancy(userTeam, rosterUsers)
  const [editPosition, setEditPosition] = useState<string | null>(
    currentPosition
  )
  const [positionLoading, setPositionLoading] = useState(false)
  const [positionError, setPositionError] = useState('')
  const [swapMessage, setSwapMessage] = useState<string | null>(null)
  const [highlightPosition, setHighlightPosition] = useState(false)
  const [prevHeadcountKey, setPrevHeadcountKey] = useState(
    `${rsvpCount}:${checkedInCount}:${showCheckInHeadcount}`
  )
  const [bumpHeadcount, setBumpHeadcount] = useState(false)

  const headcountKey = `${rsvpCount}:${checkedInCount}:${showCheckInHeadcount}`

  useEffect(() => {
    if (headcountKey !== prevHeadcountKey) {
      setBumpHeadcount(true)
      setPrevHeadcountKey(headcountKey)
      const timer = setTimeout(() => setBumpHeadcount(false), 500)
      return () => clearTimeout(timer)
    }
  }, [headcountKey, prevHeadcountKey])

  useEffect(() => {
    setEditPosition(currentPosition)
  }, [currentPosition])

  const handleSavePosition = async () => {
    if (!userRsvp || editPosition === currentPosition) return
    setPositionLoading(true)
    setPositionError('')
    setSwapMessage(null)
    try {
      const res = await updateRSVPPositionAPI(userRsvp.id, editPosition)
      updateRSVPPosition(userRsvp.id, editPosition)
      if (res.swapOccurred) {
        const name = res.otherPlayerDisplayName || 'another player'
        const message = res.swapWithReplacedPlayer
          ? `You and ${name} swapped spots — they take your spot back now that you're no longer playing as goalkeeper.`
          : `You were swapped with ${name} so each team has a goalkeeper.`
        setSwapMessage(message)
        await onTeamsRegenerated?.()
      }
    } catch (err: any) {
      setPositionError(err.message || 'Failed to update position')
    } finally {
      setPositionLoading(false)
    }
  }

  const showEditPosition = userRsvp && match.rsvpOpen && !readOnly
  const isGkChangingToNonGk =
    showEditPosition &&
    isGoalkeeper(currentPosition) &&
    !isGoalkeeper(editPosition)

  return (
    <div className="min-w-0 space-y-6">
      <section
        aria-labelledby="match-date-heading"
        className="space-y-6 overflow-hidden"
      >
        <div className="space-y-4">
          <StatusPill tone={rsvpStatus.tone}>{rsvpStatus.label}</StatusPill>
          <div>
            <p className="font-mono text-[13px] tracking-[0.14em] text-fog">
              {format(matchDate, 'EEEE').toUpperCase()}
            </p>
            <h1
              id="match-date-heading"
              className="font-display text-[clamp(4.5rem,14vw,8rem)] font-black uppercase leading-[0.86]"
            >
              {format(matchDate, 'MMM dd')}
            </h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-4xl font-extrabold text-flare">
                {formattedTime}
              </span>
              <span className="text-[15px] text-[#B9C2BD]">
                {hasMatchStarted(matchDate, match.time) ? '' : 'Kickoff '}
                <strong className="font-semibold text-chalk">
                  {getKickoffLabelForMatch(match)}
                </strong>
              </span>
            </p>
          </div>
          {match.location && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <LocationLink
                location={match.location}
                className="min-w-0 text-[15px]"
                showIcon
              />
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-fog">
              Current headcount
            </p>
            {!showCheckInHeadcount && <RosterFillMeter confirmed={rsvpCount} />}
            <p
              className={cn(
                'inline-block text-sm font-medium text-[#B9C2BD]',
                bumpHeadcount && 'animate-headcount-bump'
              )}
            >
              {showCheckInHeadcount
                ? `${checkedInCount} of ${rsvpCount} checked in`
                : `${rsvpCount} ${rsvpCount === 1 ? 'player' : 'players'} confirmed`}
            </p>
          </div>

          {showEditPosition && (
            <div
              className={cn(
                'space-y-3 border-t border-border pt-4',
                highlightPosition &&
                  'animate-slide-up-fade rounded-xl border border-[#3B5A22] bg-[#1A2A12] p-4'
              )}
            >
              <p className="font-display text-xl font-extrabold uppercase">
                Your position for this match
              </p>
              <p className="text-sm text-[#B9C2BD]">
                Current:{' '}
                <span
                  className={
                    isGoalkeeper(currentPosition)
                      ? 'rounded bg-amber-700/50 px-1.5 py-0.5 text-amber-100'
                      : undefined
                  }
                >
                  {positionLabel(currentPosition)}
                </span>
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 basis-full sm:min-w-[12rem] sm:basis-auto">
                  <PositionSelector
                    value={editPosition}
                    onValueChange={setEditPosition}
                    disabled={positionLoading}
                    hideLabel
                    occupancy={
                      Object.keys(positionOccupancy).length > 0
                        ? positionOccupancy
                        : undefined
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSavePosition}
                  loading={positionLoading}
                  disabled={editPosition === currentPosition || positionLoading}
                  className="h-11 min-w-0 shrink-0 sm:min-w-[8.5rem]"
                >
                  Update position
                </Button>
              </div>
              {isGkChangingToNonGk && (
                <p className="text-sm text-amber-400">
                  If you change from goalkeeper, another goalkeeper may take
                  your spot on this team and you may move to a different team.
                </p>
              )}
              {swapMessage && (
                <p className="text-sm text-green-400">{swapMessage}</p>
              )}
              {positionError && (
                <p className="text-sm text-red-400">{positionError}</p>
              )}
            </div>
          )}

          {readOnly ? (
            <div className="space-y-2 pt-1">
              <Button size="hero" className="w-full" disabled>
                Match ended
              </Button>
              <p className="text-sm text-fog">
                This match is over, so RSVPs and positions can no longer change.
              </p>
            </div>
          ) : match.rsvpOpen ? (
            <div className="pt-1">
              <RSVPButton
                match={match}
                onTeamsRegenerated={onTeamsRegenerated}
                onMatchRefetch={onMatchRefetch}
                onRsvpSuccess={() => setHighlightPosition(true)}
                teams={teams}
                rosterUsers={rosterUsers}
                currentUserId={currentUserId}
              />
            </div>
          ) : null}

          <CheckInButton
            match={match}
            userRsvp={userRsvp}
            onCheckedIn={onMatchRefetch}
          />
        </div>
      </section>
    </div>
  )
}
