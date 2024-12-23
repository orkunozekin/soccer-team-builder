'use client'

import AllPlayersScrollArea from '@/components/all-players/AllPlayersScrollArea'
import PlayerForm from '@/components/player-form/PlayerForm'
import GenerateTeamsButton from '@/components/teams/GenerateTeamsButton'
import TeamsContainer from '@/components/teams/TeamsContainer'

export default function Home() {
  return (
    <section className="pb-4">
      <section className="flex flex-col gap-2 px-4">
        <p className="font-medium">
          Add player name(s) below to quickly generate randomized teams
        </p>
        <PlayerForm />
        <AllPlayersScrollArea />
        <GenerateTeamsButton />
        <TeamsContainer />
      </section>
    </section>
  )
}
