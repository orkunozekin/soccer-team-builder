import { useTeamsStore } from '@/store/useTeamsStore'
import PlayerTransferTeamOptions from '../player/PlayerTransferTeamOptions'
import { KebabMenuItem } from '@/interfaces/KebabMenu.interface'
import TrashIcon from '../icons/TrashIcon'
import PlayersRowItem from './PlayersRowItem'

const AllPlayersList = () => {
  const { players, teams, deletePlayer, removeTeamPlayer, reassignPlayer } =
    useTeamsStore()

  const handleRemovePlayer = (id: string) => {
    deletePlayer(id)
    removeTeamPlayer(id)
  }

  const onReassignPlayer = (playerId: string, targetTeamId: any) => {
    reassignPlayer(playerId, targetTeamId)
  }

  return (
    <section className="flex flex-col gap-2">
      {players.map(player => {
        const teamOptions = teams.filter(
          team => team.players.filter(p => p.id === player.id).length === 0
        )
        const kebabMenuItems: KebabMenuItem[] = [
          {
            icon: <TrashIcon className="size-5" />,
            onClick: () => handleRemovePlayer(player.id),
          },
        ]
        if (teamOptions.length > 0)
          kebabMenuItems.push({
            label: (
              <PlayerTransferTeamOptions
                onReassignPlayer={onReassignPlayer}
                player={player}
                teamOptions={teamOptions}
              />
            ),
          })
        return (
          <PlayersRowItem
            className="rounded-sm border border-neutral-400 p-1"
            kebabMenuItems={kebabMenuItems}
            player={player}
            key={player.id}
          />
        )
      })}
    </section>
  )
}

export default AllPlayersList
