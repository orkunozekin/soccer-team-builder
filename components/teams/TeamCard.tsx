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
    ORANGE: { bg: 'bg-pinny-orange', text: 'text-white' },
    GREEN: { bg: 'bg-pinny-green', text: 'text-black' },
    BLUE: { bg: 'bg-pinny-blue', text: 'text-white' },
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value={team.id}
        className={cn(
          'rounded-lg border border-neutral-50 px-2',
          colors[team.color].bg
        )}
      >
        <AccordionTrigger>
          <p className="text-sm font-semibold">{team.name}</p>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-2">
            {team.players.map(player => (
              <li
                className={cn(
                  'list-inside list-decimal font-semibold',
                  colors[team.color].text
                )}
                key={player.id}
              >
                {player.name}
              </li>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
