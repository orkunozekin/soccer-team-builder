'use client'

import { User } from '@/types/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

interface BenchListProps {
  playerIds: string[]
  users: User[]
}

export function BenchList({ playerIds, users }: BenchListProps) {
  const benchUsers = playerIds
    .map((userId) => users.find((u) => u.uid === userId))
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
          {benchUsers.map((user) => (
            <div key={user.uid} className="flex items-center gap-2 text-sm">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-500 text-white text-xs font-bold">
                {user.jerseyNumber != null ? user.jerseyNumber : ''}
              </span>
              <span>{user.displayName}</span>
              {user.position && (
                <span
                  className={`ml-auto text-xs ${
                    isGoalkeeper(user.position)
                      ? 'rounded px-1.5 py-0.5 bg-amber-200/90 dark:bg-amber-700/50 text-amber-900 dark:text-amber-100'
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
