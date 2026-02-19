'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Match } from '@/types/match'

interface MatchCardProps {
  match: Match
}

export function MatchCard({ match }: MatchCardProps) {
  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMMM d')
  const formattedTime = format(matchDate, 'h:mm a')

  return (
    <Link href={`/matches/${match.id}`}>
      <Card className="transition-all hover:shadow-md cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{formattedDate}</CardTitle>
              <CardDescription className="text-base">
                {formattedTime}
              </CardDescription>
            </div>
            <Badge
              variant={match.rsvpOpen ? 'default' : 'outline'}
              className="shrink-0"
            >
              {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Click to view details and RSVP
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
