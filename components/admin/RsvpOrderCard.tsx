'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardDescription } from '@/components/ui/card'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

interface RsvpOrderCardProps {
  matchRSVPs: RSVP[]
  users: User[]
}

function positionLabel(value: string | null): string {
  if (!value) return '—'
  const p = SOCCER_POSITIONS.find(x => x.value === value)
  return p ? p.label : value
}

export function RsvpOrderCard({ matchRSVPs, users }: RsvpOrderCardProps) {
  const usersById = useMemo(() => new Map(users.map(u => [u.uid, u])), [users])

  const orderedRsvps = useMemo(
    () =>
      matchRSVPs
        .filter(r => r.status === 'confirmed')
        .sort((a, b) => a.rsvpAt.getTime() - b.rsvpAt.getTime()),
    [matchRSVPs]
  )

  return (
    <Card>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="rsvp-order" className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <span className="text-base font-semibold">
              RSVP order ({orderedRsvps.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <CardDescription className="mb-4">
              Confirmed players in the order they RSVP&apos;d (earliest first).
              Teams are filled in this order: Team 1 gets the earliest RSVPs,
              then Team 2, then Team 3, and so on.
            </CardDescription>
            {orderedRsvps.length === 0 ? (
              <p className="text-sm text-zinc-500">No confirmed RSVPs yet.</p>
            ) : (
              <ol className="max-h-80 space-y-2 overflow-y-auto">
                {orderedRsvps.map((rsvp, index) => {
                  const user = usersById.get(rsvp.userId)
                  const displayName =
                    user?.displayName || user?.email || rsvp.userId
                  const position = rsvp.position ?? user?.position ?? null

                  return (
                    <li
                      key={rsvp.id}
                      className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <span className="w-6 shrink-0 text-center font-medium text-zinc-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {displayName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {format(rsvp.rsvpAt, 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs ${
                          position && isGoalkeeper(position)
                            ? 'rounded bg-amber-200/90 px-1.5 py-0.5 text-amber-900 dark:bg-amber-700/50 dark:text-amber-100'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {positionLabel(position)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
