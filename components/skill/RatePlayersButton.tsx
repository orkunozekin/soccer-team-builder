'use client'

import { ChevronRight, Star } from 'lucide-react'

/** Admins-only entry point to rate a match's players. */
export function RatePlayersButton({
  unratedCount,
  totalCount,
  onClick,
}: {
  unratedCount: number
  totalCount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-[1.5px] border-primary bg-primary/10 px-3 py-2.5 text-left transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
      >
        <Star className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-foreground">
          Rate players
        </span>
        <span className="block text-sm text-foreground">
          {unratedCount} of {totalCount} not rated yet
        </span>
      </span>
      <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
        Admins only
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
    </button>
  )
}
