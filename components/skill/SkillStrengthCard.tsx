'use client'

import { CircleCheck, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { RebalanceStrengthSummary } from '@/types/skill'

/**
 * Admins-only result of a skill rebalance. Callers must render it only for
 * users who can manage the match; it holds no data of its own.
 */
export function SkillStrengthCard({
  summary,
  rosterHref,
  onDismiss,
}: {
  summary: RebalanceStrengthSummary
  /** Club roster link for ranking players; omitted when no club slug is known. */
  rosterHref?: string | null
  onDismiss: () => void
}) {
  const maxTotal = Math.max(0, ...summary.teams.map(t => t.total))

  return (
    <Card className="p-4" aria-labelledby="skill-strength-title">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CircleCheck
          className="h-5 w-5 shrink-0 text-success"
          aria-hidden="true"
        />
        <h3
          id="skill-strength-title"
          className="min-w-0 flex-1 text-base font-semibold text-foreground"
        >
          Balanced by skill
        </h3>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Admins only
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 h-8 w-8 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss skill balance summary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {summary.teams.map(team => {
          const pct = maxTotal > 0 ? (team.total / maxTotal) * 100 : 0
          return (
            <li
              key={team.teamNumber}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            >
              <span className="w-16 shrink-0 font-medium text-foreground">
                Team {team.teamNumber}
              </span>
              <div
                className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-foreground">
                {team.total.toFixed(1)}
              </span>
            </li>
          )
        })}
      </ul>

      {summary.unratedCount > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {summary.unratedCount} of {summary.playerCount} players have no
          ranking or questionnaire, so they count as average.
          {rosterHref && (
            <>
              {' '}
              <Link
                href={rosterHref}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Rank players
              </Link>
            </>
          )}
        </p>
      )}
    </Card>
  )
}
