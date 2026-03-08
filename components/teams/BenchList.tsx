'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { User } from '@/types/user'

interface BenchListProps {
  playerIds: string[]
  users: User[]
}

export function BenchList({ playerIds, users }: BenchListProps) {
  const benchUsers = playerIds
    .map(userId => users.find(u => u.uid === userId))
    .filter((u): u is User => !!u)

  if (benchUsers.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bench</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {benchUsers.map(user => (
            <div key={user.uid} className="flex items-center gap-2 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500 text-xs font-bold text-white">
                {user.jerseyNumber != null ? user.jerseyNumber : ''}
              </span>
              <span>{user.displayName}</span>
              {user.position && (
                <span
                  className={`ml-auto text-xs ${
                    isGoalkeeper(user.position)
                      ? 'rounded bg-amber-200/90 px-1.5 py-0.5 text-amber-900 dark:bg-amber-700/50 dark:text-amber-100'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {user.position}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
