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
    <Card className="overflow-hidden rounded-xl border-border shadow-sm">
      <CardHeader className="pb-4 sm:px-8 sm:pt-8">
        <CardTitle className="text-2xl sm:text-3xl">Player Details</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Profile information on file
        </CardDescription>
      </CardHeader>
      <CardContent className="sm:px-8 sm:pb-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Display name
            </dt>
            <dd className="mt-1 text-base font-medium text-foreground">
              {user.displayName || '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Email
            </dt>
            <dd className="mt-1 break-all text-base text-foreground">
              {user.email || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Jersey
            </dt>
            <dd className="mt-1 text-base text-foreground">
              {user.jerseyNumber == null ? '—' : user.jerseyNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Position
            </dt>
            <dd className="mt-1 text-base text-foreground">
              {positionLabel(user.position)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Role
            </dt>
            <dd className="mt-1">
              <Badge
                variant={user.role === 'super_user' ? 'default' : 'outline'}
              >
                {user.role === 'super_user' ? 'Super user' : 'User'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Joined
            </dt>
            <dd className="mt-1 text-base text-foreground">
              {format(user.createdAt, 'MMM d, yyyy')}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
