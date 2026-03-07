'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RSVPButton } from '@/components/matches/RSVPButton'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateRSVPPositionAPI } from '@/lib/api/client'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { useMatchStore } from '@/store/matchStore'
import { Match } from '@/types/match'
import { RSVP } from '@/types/rsvp'

interface MatchDetailsProps {
  match: Match
  rsvpCount: number
  userRsvp: RSVP | null
  userProfilePosition: string | null
  onTeamsRegenerated?: () => void | Promise<void>
  onMatchRefetch?: () => void | Promise<void>
}

function positionLabel(value: string | null): string {
  if (!value) return 'None'
  const p = SOCCER_POSITIONS.find((x) => x.value === value)
  return p ? p.label : value
}

export function MatchDetails({
  match,
  rsvpCount,
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
  const [editPosition, setEditPosition] = useState<string | null>(currentPosition)
  const [positionLoading, setPositionLoading] = useState(false)
  const [positionError, setPositionError] = useState('')
  const [swapMessage, setSwapMessage] = useState<string | null>(null)

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
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl sm:text-3xl mb-2">
                {formattedDate}
              </CardTitle>
              <CardDescription className="text-base sm:text-lg">
                {formattedTime}
              </CardDescription>
              {match.location && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  @ {match.location}
                </p>
              )}
            </div>
            <Badge
              variant={match.rsvpOpen ? 'default' : 'outline'}
              className="shrink-0 py-1 text-xs"
            >
              {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Current headcount
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {rsvpCount} {rsvpCount === 1 ? 'player' : 'players'} confirmed
            </p>
          </div>

          {showEditPosition && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Your position for this match
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Current:{' '}
                <span
                  className={
                    isGoalkeeper(currentPosition)
                      ? 'rounded px-1.5 py-0.5 bg-amber-200/90 dark:bg-amber-700/50 text-amber-900 dark:text-amber-100'
                      : undefined
                  }
                >
                  {positionLabel(currentPosition)}
                </span>
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 basis-full sm:basis-auto sm:min-w-[12rem]">
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
                  className="min-w-0 shrink-0 sm:min-w-[8.5rem] h-11"
                >
                  Update position
                </Button>
              </div>
              {isGkChangingToNonGk && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  If you change from goalkeeper, another goalkeeper may take your spot on this team and you may move to a different team.
                </p>
              )}
              {swapMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {swapMessage}
                </p>
              )}
              {positionError && (
                <p className="text-sm text-red-600 dark:text-red-400">{positionError}</p>
              )}
            </div>
          )}

          {match.rsvpOpen && (
            <div className="pt-4">
              <RSVPButton
                match={match}
                onTeamsRegenerated={onTeamsRegenerated}
                onMatchRefetch={onMatchRefetch}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
