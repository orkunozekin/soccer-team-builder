'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Calendar, Users } from 'lucide-react'
import { CheckInButton } from '@/components/matches/CheckInButton'
import { LocationLink } from '@/components/matches/LocationLink'
import { RSVPButton } from '@/components/matches/RSVPButton'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { updateRSVPPositionAPI } from '@/lib/api/client'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { useMatchStore } from '@/store/matchStore'
import { Match } from '@/types/match'
import { RSVP } from '@/types/rsvp'

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
}: MatchDetailsProps) {
  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMM d')
  const formattedTime = format(matchDate, 'h:mm a')

  const { updateRSVPPosition } = useMatchStore()
  const currentPosition = userRsvp?.position ?? userProfilePosition ?? null
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

  const showEditPosition = userRsvp && match.rsvpOpen
  const isGkChangingToNonGk =
    showEditPosition &&
    isGoalkeeper(currentPosition) &&
    !isGoalkeeper(editPosition)

  return (
    <div className="min-w-0 space-y-6">
      <Card className="card-soccer-accent overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="mb-2 text-2xl sm:text-3xl">
                {formattedDate}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="h-4 w-4 shrink-0 text-red-50" />
                {formattedTime}
              </CardDescription>
              {match.location && (
                <LocationLink
                  location={match.location}
                  className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
                  showIcon
                />
              )}
            </div>
            <Badge
              variant={match.rsvpOpen ? 'default' : 'outline'}
              className={`shrink-0 py-1 text-xs ${
                match.rsvpOpen ? 'animate-badge-pulse' : ''
              }`}
            >
              {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-red-95/60 px-4 py-3 dark:bg-red-20/20">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <Users className="h-4 w-4 text-red-50" />
              Current headcount
            </p>
            <p
              className={`text-sm font-medium text-zinc-600 dark:text-zinc-400 ${
                bumpHeadcount ? 'animate-headcount-bump' : ''
              }`}
            >
              {showCheckInHeadcount
                ? `${checkedInCount} of ${rsvpCount} checked in`
                : `${rsvpCount} ${rsvpCount === 1 ? 'player' : 'players'} confirmed`}
            </p>
          </div>

          {showEditPosition && (
            <div
              className={`space-y-3 border-t border-zinc-200 pt-2 dark:border-zinc-800 ${
                highlightPosition
                  ? 'animate-slide-up-fade rounded-lg bg-red-95/40 p-3 dark:bg-red-20/10'
                  : ''
              }`}
            >
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Your position for this match
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Current:{' '}
                <span
                  className={
                    isGoalkeeper(currentPosition)
                      ? 'rounded bg-amber-200/90 px-1.5 py-0.5 text-amber-900 dark:bg-amber-700/50 dark:text-amber-100'
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
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  If you change from goalkeeper, another goalkeeper may take
                  your spot on this team and you may move to a different team.
                </p>
              )}
              {swapMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {swapMessage}
                </p>
              )}
              {positionError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {positionError}
                </p>
              )}
            </div>
          )}

          {match.rsvpOpen && (
            <div className="pt-4">
              <RSVPButton
                match={match}
                onTeamsRegenerated={onTeamsRegenerated}
                onMatchRefetch={onMatchRefetch}
                onRsvpSuccess={() => setHighlightPosition(true)}
              />
            </div>
          )}

          <CheckInButton
            match={match}
            userRsvp={userRsvp}
            onCheckedIn={onMatchRefetch}
          />
        </CardContent>
      </Card>
    </div>
  )
}
