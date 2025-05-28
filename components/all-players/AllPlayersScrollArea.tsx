'use client'

import { useTeamsStore } from '@/store/useTeamsStore'
import AllPlayersList from './AllPlayersList'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function AllPlayersScrollArea() {
  const { players, clearPlayers } = useTeamsStore()

  const playerCount = players.length

  return (
    <>
      {!!playerCount ? (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem
            value="all-players"
            className={cn('rounded-lg border border-neutral-50 px-2')}
          >
            <AccordionTrigger className="hover:no-underline [&_svg]:text-black">
              <h4 className="font-semibold">All Players ({playerCount})</h4>
            </AccordionTrigger>
            <AccordionContent>
              <AllPlayersList />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </>
  )
}
