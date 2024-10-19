'use client'

import AllPlayersScrollArea from '@/components/all-players/AllPlayersScrollArea'
import PlayerForm from '@/components/player-form/PlayerForm'

export default function Home() {
  return (
    <section>
      <header className="mb-4 flex items-center justify-center bg-red-50 py-2 font-semibold text-white">
        Pickup Soccer Team Builder
      </header>
      <section className="flex flex-col gap-2 px-4">
        <p>Add player name(s) below to quickly form randomized teams</p>
        <PlayerForm />
        <AllPlayersScrollArea />
      </section>
    </section>
  )
}
