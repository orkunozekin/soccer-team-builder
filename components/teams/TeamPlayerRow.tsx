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
import useTeamsStore from '@/store/useTeamsStore'

type Props = {
  team: Team
}

export default function TeamPlayerRow({ team }: Props) {
  const { teams, reassignPlayer } = useTeamsStore()
  const onReassignPlayer = (playerId: string, targetTeamId: any) => {
    reassignPlayer(playerId, targetTeamId)
  }

  const teamReassingOptions = teams.filter(t => t.id !== team.id)

  return (
    <section>
      {team.players.map(player => (
        <li
          className="flex list-inside list-decimal items-center justify-between py-1 font-semibold text-black"
          key={player.id}
        >
          <p>{player.name}</p>
          <Select onValueChange={value => onReassignPlayer(player.id, value)}>
            <SelectTrigger className="w-[180px] border-neutral-10 font-normal">
              <SelectValue placeholder="Transfer to" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Teams</SelectLabel>
                {teamReassingOptions.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </li>
      ))}
    </section>
  )
}
