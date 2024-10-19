'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayersStore } from '@/store/usePlayerStore'
import PlayerName from './PlayerName'
import CloseIcon from '../icons/CloseIcon'

export default function AllPlayersScrollArea() {
  const { players, clearPlayers } = usePlayersStore()

  const playerCount = players.length

  const isLastPlayer = (idx: number) => idx === playerCount - 1

  return (
    <>
      {players.length > 0 ? (
        <ScrollArea className="h-52 rounded-md border">
          <section className="px-4 pb-4">
            <div className="sticky top-0 z-10 flex justify-between bg-white py-2">
              <div className="flex items-center gap-1 font-semibold">
                <h4>All Players</h4>
                {playerCount > 0 ? <p>({playerCount})</p> : null}
              </div>
              <CloseIcon onClick={clearPlayers} />
            </div>
            {players.map((player, idx) => (
              <section key={player.id} className="flex flex-col gap-2">
                <PlayerName player={player} />
                {isLastPlayer(idx) ? null : <hr className="mb-2" />}
              </section>
            ))}
          </section>
        </ScrollArea>
      ) : null}
    </>
  )
}
