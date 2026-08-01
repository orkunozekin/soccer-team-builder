'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import type { User } from '@/types/user'

function positionLabel(value: string | null): string {
  if (!value) return '—'
  const p = SOCCER_POSITIONS.find(x => x.value === value)
  return p ? p.label : value
}

interface PlayerProfileDetailsProps {
  user: User
}

export function PlayerProfileDetails({ user }: PlayerProfileDetailsProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm dark:border-zinc-800">
      <CardHeader className="pb-4 sm:px-8 sm:pt-8">
        <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
          Player Details
        </CardTitle>
        <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
          Profile information on file
        </CardDescription>
      </CardHeader>
      <CardContent className="sm:px-8 sm:pb-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Display name
            </dt>
            <dd className="mt-1 text-base font-medium text-zinc-900 dark:text-zinc-100">
              {user.displayName || '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Email
            </dt>
            <dd className="mt-1 break-all text-base text-zinc-900 dark:text-zinc-100">
              {user.email || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Jersey
            </dt>
            <dd className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
              {user.jerseyNumber == null ? '—' : user.jerseyNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Position
            </dt>
            <dd className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
              {positionLabel(user.position)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Role
            </dt>
            <dd className="mt-1">
              <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                {user.role === 'admin' ? 'Admin' : 'User'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Joined
            </dt>
            <dd className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
              {format(user.createdAt, 'MMM d, yyyy')}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
