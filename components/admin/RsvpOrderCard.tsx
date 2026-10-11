'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { RestoreRsvpOrderButton } from '@/components/admin/RestoreRsvpOrderButton'
import { SectionAccordionTrigger } from '@/components/admin/SectionAccordionTrigger'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { useClientPagination } from '@/lib/hooks/useClientPagination'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

interface RsvpOrderCardProps {
  matchRSVPs: RSVP[]
  users: User[]
  /** When set with onRestoreComplete, shows the admin restore control. */
  matchId?: string
  onRestoreComplete?: () => void
}

export function RsvpOrderCard({
  matchRSVPs,
  users,
  matchId,
  onRestoreComplete,
}: RsvpOrderCardProps) {
  const usersById = useMemo(() => new Map(users.map(u => [u.uid, u])), [users])

  const orderedRsvps = useMemo(
    () =>
      matchRSVPs
        .filter(r => r.status === 'confirmed')
        .sort((a, b) => a.rsvpAt.getTime() - b.rsvpAt.getTime()),
    [matchRSVPs]
  )

  const paged = useClientPagination(orderedRsvps, matchRSVPs[0]?.matchId)
  const canRestore =
    Boolean(matchId && onRestoreComplete) && orderedRsvps.length >= 2

  return (
    <Card>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="rsvp-order" className="border-0">
          <SectionAccordionTrigger
            title={`RSVP order (${orderedRsvps.length})`}
            description="Confirmed players in the order they RSVP'd (earliest first). Teams are filled in this order: Team 1 gets the earliest RSVPs, then Team 2, then Team 3, and so on."
          />
          <AccordionContent className="px-6 pb-4">
            {orderedRsvps.length === 0 ? (
              <p className="text-sm text-zinc-500">No confirmed RSVPs yet.</p>
            ) : (
              <ol start={paged.offset + 1} className="space-y-2">
                {paged.items.map((rsvp, index) => {
                  const user = usersById.get(rsvp.userId)
                  const displayName =
                    user?.displayName || user?.email || rsvp.userId

                  return (
                    <li
                      key={rsvp.id}
                      className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <span className="w-6 shrink-0 text-center font-medium text-zinc-500">
                        {paged.offset + index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {displayName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {format(rsvp.rsvpAt, 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {paged.pagination.totalPages > 1 && (
              <Pagination {...paged.pagination} itemLabel="RSVPs" />
            )}
            {matchId && onRestoreComplete && (
              <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Rebuild teams from this RSVP order and goalkeeper priority.
                  Saved admin transfers are re-applied afterward.
                </p>
                <RestoreRsvpOrderButton
                  matchId={matchId}
                  onDone={onRestoreComplete}
                  disabled={!canRestore}
                  className="h-11 w-full sm:h-9 sm:w-auto"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
