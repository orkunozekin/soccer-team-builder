'use client'

import { type ReactNode, useId } from 'react'
import { AccordionTrigger } from '@/components/ui/accordion'

/**
 * Accordion header that keeps a section summary visible while collapsed.
 * The button is named by the title alone; the summary is its description, so
 * screen readers do not read a long paragraph as the control's label.
 */
export function SectionAccordionTrigger({
  title,
  description,
}: {
  title: ReactNode
  description: ReactNode
}) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  return (
    <AccordionTrigger
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="gap-4 px-6 py-4 text-left hover:no-underline"
    >
      <span className="flex flex-col gap-1">
        <span id={titleId} className="text-base font-semibold">
          {title}
        </span>
        <span
          id={descriptionId}
          className="font-normal text-zinc-500 dark:text-zinc-400"
        >
          {description}
        </span>
      </span>
    </AccordionTrigger>
  )
}
