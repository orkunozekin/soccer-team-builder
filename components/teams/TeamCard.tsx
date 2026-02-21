'use client'

import { User } from '@/types/user'
import { Team } from '@/types/team'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

interface TeamCardProps {
  team: Team
  users: User[]
}

export function TeamCard({ team, users }: TeamCardProps) {
  const teamUsers = team.playerIds
    .map((userId) => users.find((u) => u.uid === userId))
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
            teamUsers.map((user) => (
              <div
                key={user.uid}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: team.color || '#3b82f6' }}
                >
                  {user.jerseyNumber != null ? user.jerseyNumber : ''}
                </span>
                <span>{user.displayName}</span>
                {user.position && (
                  <Badge
                    variant="outline"
                    className={`ml-auto text-xs ${
                      isGoalkeeper(user.position)
                        ? 'bg-amber-200/90 dark:bg-amber-700/50 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100'
                        : ''
                    }`}
                  >
                    {user.position}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
