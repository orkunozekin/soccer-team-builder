'use client'

import Link from 'next/link'
import type { ClubWorkspaceSection } from '@/lib/hooks/useClubWorkspace'
import { cn } from '@/lib/utils'
import {
  clubChromeFgClass,
  clubChromeFillClass,
  clubChromeHoverClass,
} from '@/lib/utils/clubBranding'

export function ClubNav({
  sections,
  activeHref,
  onNavigate,
}: {
  sections: ClubWorkspaceSection[]
  activeHref?: string
  onNavigate?: () => void
}) {
  if (sections.length === 0) return null

  return (
    <nav aria-label="Club sections" className="flex flex-col gap-1">
      {sections.map(section => {
        const active = section.href === activeHref
        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'rounded-md border-l-[6px] px-3 py-2 text-sm font-semibold transition-colors',
              clubChromeFgClass,
              active
                ? cn(
                    'border-[color:var(--club-foreground)]',
                    clubChromeFillClass
                  )
                : cn('border-transparent', clubChromeHoverClass)
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
