import { Team } from '@/interfaces/Team.interface'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import TeamPlayerRow from './TeamPlayerRow'
import TeamColorEdit from './TeamColorEdit'

type Props = {
  team: Team
}

export default function TeamCard({ team }: Props) {
  const colors = {
    ORANGE: 'bg-pinny-orange',
    GREEN: 'bg-pinny-green',
    BLUE: 'bg-pinny-blue',
    RED: 'bg-red-60',
  }

  const playerCount = team.players.length

  console.log(team.color)

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem
        value={team.id}
        className={cn(
          'rounded-lg border border-neutral-50 px-2',
          colors[team.color]
        )}
      >
        <AccordionTrigger className="hover:no-underline [&_svg]:text-black">
          <p className="text-sm font-semibold">
            {team.name} ({playerCount})
          </p>
        </AccordionTrigger>
        <AccordionContent>
          <section className="flex flex-col gap-4 pl-2">
            <TeamColorEdit team={team} />
            <TeamPlayerRow team={team} />
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
