import { Team } from '@/interfaces/Team.interface'
import { useTeamsStore } from '@/store/useTeamsStore'
import TrashIcon from '../icons/TrashIcon'
import { KebabMenuItem } from '@/interfaces/KebabMenu.interface'
import PlayerTransferTeamOptions from '../player/PlayerTransferTeamOptions'
import PlayersRowItem from '../all-players/PlayersRowItem'

type Props = {
  team: Team
}

export default function TeamPlayerRow({ team }: Props) {
  const { teams, reassignPlayer, removeTeamPlayer } = useTeamsStore()
  const onReassignPlayer = (playerId: string, targetTeamId: any) => {
    reassignPlayer(playerId, targetTeamId)
  }

  const teamOptions = teams.filter(t => t.id !== team.id)

  return (
    <section className="flex flex-col gap-1">
      {team.players.map(player => {
        const kebabMenuItems: KebabMenuItem[] = [
          {
            icon: <TrashIcon className="size-5" />,
            onClick: () => removeTeamPlayer(player.id),
          },
          {
            label: (
              <PlayerTransferTeamOptions
                onReassignPlayer={onReassignPlayer}
                player={player}
                teamOptions={teamOptions}
              />
            ),
          },
        ]
        return (
          <PlayersRowItem
            key={player.id}
            kebabMenuItems={kebabMenuItems}
            player={player}
            className="rounded-sm border border-neutral-20 p-1.5"
          />
        )
      })}
    </section>
  )
}
