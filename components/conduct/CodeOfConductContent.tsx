import {
  CODE_OF_CONDUCT_INTRO,
  CODE_OF_CONDUCT_SECTIONS,
} from '@/lib/conduct/codeOfConduct'
import { cn } from '@/lib/utils'

export function CodeOfConductContent({
  className,
  headingLevel = 'h3',
}: {
  className?: string
  headingLevel?: 'h2' | 'h3'
}) {
  const Heading = headingLevel
  return (
    <div className={cn('space-y-4 text-sm', className)}>
      <p className="text-mist">{CODE_OF_CONDUCT_INTRO}</p>
      {CODE_OF_CONDUCT_SECTIONS.map(section => (
        <section key={section.title} className="space-y-1.5">
          <Heading className="font-medium text-foreground">
            {section.title}
          </Heading>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {section.points.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
