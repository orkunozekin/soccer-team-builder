'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import CloseIcon from '../icons/CloseIcon'
import { useTeamsStore } from '@/store/useTeamsStore'
import AllPlayersList from './AllPlayersList'
import { cn } from '@/lib/utils'

export default function AllPlayersScrollArea() {
  const { players, clearPlayers } = useTeamsStore()

  const playerCount = players.length

  return (
    <>
      {!!playerCount ? (
        <ScrollArea
          className={cn('rounded-md border', playerCount >= 6 ? 'h-52' : '')}
        >
          <section className="px-3 pb-3">
            <div className="sticky top-0 z-10 flex justify-between bg-white py-2">
              <div className="flex items-center gap-1 font-semibold">
                <h4>All Players</h4>
                <p>({playerCount})</p>
              </div>
              <CloseIcon onClick={clearPlayers} />
            </div>
            <AllPlayersList />
          </section>
        </ScrollArea>
      ) : null}
    </>
  )
}
