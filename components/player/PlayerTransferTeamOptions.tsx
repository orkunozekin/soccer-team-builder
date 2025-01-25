import { Player } from '@/interfaces/Player.interface'
import { Team } from '@/interfaces/Team.interface'
import { cn } from '@/lib/utils'
import React from 'react'

type Props = {
  player: Player
  teamOptions: Team[]
  onReassignPlayer: (playerId: string, targetTeamId: any) => void
}

const PlayerTransferTeamOptions = ({
  player,
  teamOptions,
  onReassignPlayer,
}: Props) => {
  const colors = {
    ORANGE: 'bg-pinny-orange',
    GREEN: 'bg-pinny-green',
    BLUE: 'bg-pinny-blue',
    RED: 'bg-red-60',
  }
  return (
    <section className="flex gap-1">
      {teamOptions.map(team => {
        const teamColor = colors[team.color]
        return (
          <div
            key={team.id}
            className={cn('size-6 rounded-sm', teamColor)}
            onClick={() => onReassignPlayer(player.id, team.id)}
          />
        )
      })}
    </section>
  )
}

export default PlayerTransferTeamOptions
