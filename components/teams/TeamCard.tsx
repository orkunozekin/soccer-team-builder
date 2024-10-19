import { Team } from '@/interfaces/Team.interface'

type Props = {
  team: Team
}

export default function TeamCard({ team }: Props) {
  return (
    <section className="w-full rounded-lg border border-neutral-50 p-4">
      <p>{team.name}</p>
      <div>
        {team.players.map(player => (
          <li key={player.id}>{player.name}</li>
        ))}
      </div>
    </section>
  )
}
