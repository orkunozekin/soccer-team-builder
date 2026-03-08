'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Team } from '@/types/team'
import { User } from '@/types/user'

interface TeamCardProps {
  team: Team
  users: User[]
  /** When set, the current user's row is highlighted */
  currentUserId?: string | null
}

export function TeamCard({ team, users, currentUserId }: TeamCardProps) {
  const teamUsers = team.playerIds
    .map(userId => users.find(u => u.uid === userId))
    .filter((u): u is User => !!u)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{team.name || `Team ${team.teamNumber}`}</CardTitle>
          <Badge
            style={{ backgroundColor: team.color || '#3b82f6' }}
            className="text-white"
          >
            {team.playerIds.length}/{team.maxSize}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teamUsers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No players assigned
            </p>
          ) : (
            teamUsers.map(user => {
              const isCurrentUser =
                currentUserId != null && user.uid === currentUserId
              return (
                <div
                  key={user.uid}
                  className={`-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                    isCurrentUser
                      ? 'bg-primary/10 font-medium ring-1 ring-primary/40 dark:bg-primary/20 dark:ring-primary/50'
                      : ''
                  }`}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: team.color || '#3b82f6' }}
                  >
                    {user.jerseyNumber != null ? user.jerseyNumber : ''}
                  </span>
                  <span>{user.displayName}</span>
                  {user.position && (
                    <Badge
                      variant="outline"
                      className={`ml-auto shrink-0 text-xs ${
                        isGoalkeeper(user.position)
                          ? 'border-amber-400 bg-amber-200/90 text-amber-900 dark:border-amber-600 dark:bg-amber-700/50 dark:text-amber-100'
                          : ''
                      }`}
                    >
                      {user.position}
                    </Badge>
                  )}
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
