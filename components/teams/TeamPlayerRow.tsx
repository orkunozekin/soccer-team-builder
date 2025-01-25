import { Team } from '@/interfaces/Team.interface'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeamsStore } from '@/store/useTeamsStore'
import TrashIcon from '../icons/TrashIcon'

type Props = {
  team: Team
}

export default function TeamPlayerRow({ team }: Props) {
  const { teams, reassignPlayer, removeTeamPlayer } = useTeamsStore()
  const onReassignPlayer = (playerId: string, targetTeamId: any) => {
    reassignPlayer(playerId, targetTeamId)
  }

  const teamReassignOptions = teams.filter(t => t.id !== team.id)

  return (
    <section>
      {team.players.map(player => (
        <li
          className="flex list-inside list-decimal items-center justify-between py-1 font-semibold text-black"
          key={player.id}
        >
          <p className="w-[50%]">{player.name}</p>
          <section className="flex w-[50%] items-center gap-1">
            <Select onValueChange={value => onReassignPlayer(player.id, value)}>
              <SelectTrigger className="border-neutral-10 font-normal">
                <SelectValue placeholder="Transfer to" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Teams</SelectLabel>
                  {teamReassignOptions.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="rounded-md border border-neutral-10 p-2">
              <TrashIcon onClick={() => removeTeamPlayer(player.id)} />
            </div>
          </section>
        </li>
      ))}
    </section>
  )
}
