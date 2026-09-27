'use client'

import Link from 'next/link'
import type { ClubWorkspaceSection } from '@/lib/hooks/useClubWorkspace'
import { cn } from '@/lib/utils'

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
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
