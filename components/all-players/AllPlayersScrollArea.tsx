'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayersStore } from '@/store/usePlayerStore'
import PlayerName from './PlayerName'

export default function AllPlayersScrollArea() {
  const { players } = usePlayersStore()

  return (
    <>
      {players.length > 0 ? (
        <ScrollArea className="h-60 w-48 rounded-md border">
          <section className="p-4">
            <h4 className="mb-4 text-sm font-medium leading-none">
              All Players
            </h4>
            {players.map(player => (
              <section key={player.id} className="flex flex-col gap-2">
                <PlayerName player={player} />
                <hr className="mb-2" />
              </section>
            ))}
          </section>
        </ScrollArea>
      ) : null}
    </>
  )
}
