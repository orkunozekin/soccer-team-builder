import { Team } from '@/interfaces/Team.interface'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import TeamPlayerRow from './TeamPlayerRow'

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
    <Accordion type="single" collapsible className="w-full">
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
            <TeamPlayerRow team={team} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
