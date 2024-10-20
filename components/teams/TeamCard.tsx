import { Team, TeamColor } from '@/interfaces/Team.interface'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

type Props = {
  team: Team
}

export default function TeamCard({ team }: Props) {
  const colors = {
    ORANGE: 'bg-pinny-orange',
    GREEN: 'bg-pinny-green',
    BLUE: 'bg-pinny-blue',
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value={team.id}
        className={cn(
          'rounded-lg border border-neutral-50 px-2',
          colors[team.color]
        )}
      >
        <AccordionTrigger>
          <p className="text-sm font-semibold">{team.name}</p>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-2">
            {team.players.map(player => (
              <li className="list-inside list-decimal" key={player.id}>
                {player.name}
              </li>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
