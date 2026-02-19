'use client'

import { format } from 'date-fns'
import { Match } from '@/types/match'
import { RSVPButton } from '@/components/matches/RSVPButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface MatchDetailsProps {
  match: Match
  rsvpCount: number
  onTeamsRegenerated?: () => void | Promise<void>
}

export function MatchDetails({ match, rsvpCount, onTeamsRegenerated }: MatchDetailsProps) {
  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMMM d')
  const formattedTime = format(matchDate, 'h:mm a')

  return (
    <div className="space-y-6">
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
            </div>
            <Badge
              variant={match.rsvpOpen ? 'default' : 'outline'}
              className="shrink-0 text-sm"
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

          {match.rsvpOpen && (
            <div className="pt-4">
              <RSVPButton match={match} onTeamsRegenerated={onTeamsRegenerated} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
