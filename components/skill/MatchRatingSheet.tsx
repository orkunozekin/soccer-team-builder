'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { saveClubSkillRankingAPI } from '@/lib/api/client'
import { diffSkillRatings, setSkillRating } from '@/lib/skill/ratingEdits'
import { MAX_SKILL_RATING, MIN_SKILL_RATING } from '@/lib/skill/scoring'
import { cn } from '@/lib/utils'
import type {
  ClubSkillRankingDTO,
  SkillRating,
  SkillRatings,
} from '@/types/skill'

export type MatchRatingPlayer = {
  userId: string
  displayName: string
  position: string | null
  teamName: string
  teamColor: string
}

type Filter = 'all' | 'unrated'

const RATING_VALUES = Array.from(
  { length: MAX_SKILL_RATING - MIN_SKILL_RATING + 1 },
  (_, i) => (MIN_SKILL_RATING + i) as SkillRating
)

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Failed to save player ratings'
}

/**
 * Admins rate the players on a match's teams, 1–10. Ratings are club-wide
 * (the same ones as the roster page). Only changed ratings are sent, so the
 * later of two admins' saves wins for a player both changed.
 */
export function MatchRatingSheet({
  open,
  onOpenChange,
  clubId,
  players,
  ratings,
  memberIds,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clubId: string
  players: readonly MatchRatingPlayer[]
  /** The club's saved ratings when the sheet opened. */
  ratings: SkillRatings
  /** Active club members; only they can be rated. */
  memberIds: ReadonlySet<string>
  onSaved: (ranking: ClubSkillRankingDTO) => void
}) {
  const [draft, setDraft] = useState<SkillRatings>(ratings)
  const [snapshot, setSnapshot] = useState<SkillRatings>(ratings)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  // Bumped whenever the sheet opens or unmounts; a save from an earlier
  // opening must not touch this one.
  const openGenRef = useRef(0)

  // Reset on every open: a programmatic close (after Save) doesn't fire
  // onOpenChange, so nothing from the last session may carry over.
  useEffect(() => {
    if (!open) return
    openGenRef.current++
    setDraft(ratings)
    setSnapshot(ratings)
    setFilter('all')
    setExpanded(null)
    setError('')
    setSaving(false)
    savingRef.current = false
    // Only re-seed when the sheet opens, not when ratings refresh behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(
    () => () => {
      openGenRef.current++
    },
    []
  )

  const rateable = (uid: string) => memberIds.has(uid)

  // Order and the Unrated filter use the ratings as they were when the sheet
  // opened, so a row doesn't jump or vanish while you rate it.
  const ordered = useMemo(() => {
    const byName = [...players].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: 'base',
      })
    )
    const unrated = byName.filter(
      p => rateable(p.userId) && snapshot[p.userId] === undefined
    )
    const rest = byName.filter(p => !unrated.includes(p))
    return { all: [...unrated, ...rest], unrated }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, snapshot, memberIds])

  const shown = filter === 'unrated' ? ordered.unrated : ordered.all
  const changes = diffSkillRatings(snapshot, draft)
  const changeCount = Object.keys(changes).length
  const ratedCount = players.filter(
    p => rateable(p.userId) && draft[p.userId] !== undefined
  ).length
  const rateableCount = players.filter(p => rateable(p.userId)).length

  const setRating = (uid: string, rating: SkillRating | null) => {
    setDraft(current => setSkillRating(current, uid, rating))
    setError('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && savingRef.current) return
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (changeCount === 0 || savingRef.current) return
    const gen = openGenRef.current
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const res = await saveClubSkillRankingAPI(clubId, changes)
      if (gen !== openGenRef.current) return
      onSaved(res.ranking)
      onOpenChange(false)
    } catch (err: unknown) {
      if (gen !== openGenRef.current) return
      setError(errorMessage(err))
    } finally {
      if (gen === openGenRef.current) {
        savingRef.current = false
        setSaving(false)
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col gap-0 rounded-t-2xl p-0"
      >
        <div className="space-y-3 border-b border-border px-5 pb-3 pt-5">
          <div className="pr-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admins only
            </p>
            <SheetTitle className="font-display text-2xl font-extrabold uppercase leading-none tracking-[0.02em]">
              Rate players
            </SheetTitle>
            <SheetDescription className="mt-1">
              1 = weakest, 10 = strongest. Ratings apply to every match in this
              club.
            </SheetDescription>
          </div>
          <div
            role="radiogroup"
            aria-label="Show"
            className="flex flex-wrap gap-2"
          >
            {(
              [
                ['all', `All ${players.length}`],
                ['unrated', `Unrated ${ordered.unrated.length}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'h-9 rounded-full border px-3 text-sm font-semibold transition-colors',
                  filter === value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-foreground hover:bg-accent'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Everyone is rated.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map(player => {
                const uid = player.userId
                const canRate = rateable(uid)
                const rating = draft[uid] ?? null
                const isOpen = expanded === uid
                return (
                  <li key={uid}>
                    <button
                      type="button"
                      disabled={!canRate || saving}
                      aria-expanded={canRate ? isOpen : undefined}
                      onClick={() => setExpanded(isOpen ? null : uid)}
                      className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold text-foreground">
                          {player.displayName}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: player.teamColor }}
                          />
                          {[
                            player.teamName,
                            player.position,
                            canRate ? null : 'Not a club member',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {canRate && (
                        <span
                          aria-label={
                            rating === null
                              ? `${player.displayName}: not rated`
                              : `${player.displayName}: rated ${rating}`
                          }
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold',
                            rating === null
                              ? 'border-[1.5px] border-dashed border-border text-muted-foreground'
                              : 'bg-primary text-primary-foreground'
                          )}
                        >
                          {rating ?? '–'}
                        </span>
                      )}
                    </button>
                    {canRate && isOpen && (
                      <div className="grid grid-cols-5 gap-1.5 pb-3">
                        <div
                          role="radiogroup"
                          aria-label={`Rating for ${player.displayName}`}
                          className="col-span-5 grid grid-cols-5 gap-1.5"
                        >
                          {RATING_VALUES.map(value => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={rating === value}
                              disabled={saving}
                              onClick={() => setRating(uid, value)}
                              className={cn(
                                'h-11 rounded-lg border font-mono text-base font-bold transition-colors',
                                rating === value
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-foreground hover:bg-accent'
                              )}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={saving || rating === null}
                          onClick={() => setRating(uid, null)}
                          className="col-span-5 h-10 rounded-lg border border-dashed border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
                        >
                          Clear rating
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-border px-5 pb-6 pt-3">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="min-w-[8rem] flex-1 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {changeCount > 0
                ? `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`
                : `${ratedCount} of ${rateableCount} rated`}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={saving}
              disabled={changeCount === 0}
              onClick={() => void handleSave()}
              aria-label="Save ratings"
            >
              Save ratings
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
