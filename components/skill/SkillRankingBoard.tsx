'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import {
  getClubSkillRankingAPI,
  saveClubSkillRankingAPI,
} from '@/lib/api/client'
import {
  keepRatedMembers,
  setSkillRating,
  skillRatingsEqual,
} from '@/lib/skill/ratingEdits'
import {
  MAX_SKILL_RATING,
  MIN_SKILL_RATING,
  isSkillRating,
} from '@/lib/skill/scoring'
import type {
  SkillRankingMemberDTO,
  SkillRating,
  SkillRatings,
} from '@/types/skill'

export const SKILL_RANKING_CONFLICT_MESSAGE =
  'Another admin changed the ratings. Reload to see their changes.'

const NOT_RATED = 'none'

const RATING_OPTIONS = Array.from(
  { length: MAX_SKILL_RATING - MIN_SKILL_RATING + 1 },
  (_, i) => String(MIN_SKILL_RATING + i)
)

type LoadStatus = 'loading' | 'error' | 'loaded'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/**
 * Club admins rate each active member from 1 to 10; Rebalance uses the
 * ratings. Callers must render it only for club admins with
 * `skill-balanced-teams` on.
 */
export function SkillRankingBoard({ clubId }: { clubId: string }) {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [members, setMembers] = useState<SkillRankingMemberDTO[]>([])
  const [saved, setSaved] = useState<{
    ratings: SkillRatings
    version: number
  } | null>(null)
  const [draft, setDraft] = useState<SkillRatings>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  // Bumped on every load, club change and unmount; responses from an older
  // generation are dropped.
  const genRef = useRef(0)
  const savingRef = useRef(false)

  const load = useCallback((targetClubId: string) => {
    const gen = ++genRef.current
    setLoadStatus('loading')
    setLoadError('')
    void getClubSkillRankingAPI(targetClubId)
      .then(res => {
        if (gen !== genRef.current) return
        const ratings = keepRatedMembers(
          res.ranking.ratings,
          res.members.map(m => m.userId)
        )
        setMembers(res.members)
        setSaved({ ratings, version: res.ranking.version })
        setDraft(ratings)
        setConflict(false)
        setSaveError('')
        setJustSaved(false)
        setLoadStatus('loaded')
      })
      .catch((err: unknown) => {
        if (gen !== genRef.current) return
        setLoadError(errorMessage(err, 'Failed to load player ratings'))
        setLoadStatus('error')
      })
  }, [])

  useEffect(() => {
    setMembers([])
    setSaved(null)
    setDraft({})
    setSaving(false)
    savingRef.current = false
    setSaveError('')
    setConflict(false)
    setJustSaved(false)
    load(clubId)
    return () => {
      genRef.current++
    }
  }, [clubId, load])

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        })
      ),
    [members]
  )
  const dirty = saved !== null && !skillRatingsEqual(draft, saved.ratings)
  const ratedCount = members.filter(m => draft[m.userId] !== undefined).length

  const handleRatingChange = (userId: string, rating: SkillRating | null) => {
    setDraft(current => setSkillRating(current, userId, rating))
    setJustSaved(false)
    setSaveError('')
  }

  const handleDiscard = () => {
    if (!saved) return
    setDraft(saved.ratings)
    setJustSaved(false)
    setSaveError('')
  }

  const handleSave = async () => {
    if (!saved || !dirty || conflict || savingRef.current) return
    const gen = genRef.current
    const memberIds = members.map(m => m.userId)
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    setJustSaved(false)
    try {
      const res = await saveClubSkillRankingAPI(clubId, {
        ratings: draft,
        version: saved.version,
      })
      if (gen !== genRef.current) return
      const ratings = keepRatedMembers(res.ranking.ratings, memberIds)
      setSaved({ ratings, version: res.ranking.version })
      setDraft(ratings)
      setJustSaved(true)
    } catch (err: unknown) {
      if (gen !== genRef.current) return
      if ((err as { status?: number }).status === 409) {
        setConflict(true)
      } else {
        setSaveError(errorMessage(err, 'Failed to save player ratings'))
      }
    } finally {
      if (gen === genRef.current) {
        savingRef.current = false
        setSaving(false)
      }
    }
  }

  const header = (
    <div className="space-y-1 border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2
          id="skill-ranking-title"
          className="flex-1 whitespace-nowrap text-base font-semibold text-foreground"
        >
          Player ratings
        </h2>
        {dirty && <StatusPill tone="neutral">Unsaved changes</StatusPill>}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Admins only
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Rate each player from 1 to 10. Rebalance teams uses these ratings;
        unrated players count as 5.5.
      </p>
    </div>
  )

  if (loadStatus === 'loading') {
    return (
      <Card
        className="overflow-hidden"
        aria-labelledby="skill-ranking-title"
        aria-busy="true"
      >
        {header}
        <div
          className="space-y-3 px-4 py-4"
          aria-label="Loading player ratings"
        >
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    )
  }

  if (loadStatus === 'error') {
    return (
      <Card className="overflow-hidden" aria-labelledby="skill-ranking-title">
        {header}
        <div className="space-y-3 px-4 py-4" role="alert">
          <p className="text-sm text-danger">{loadError}</p>
          <Button type="button" variant="outline" onClick={() => load(clubId)}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const controlsDisabled = saving || conflict

  return (
    <Card className="overflow-hidden" aria-labelledby="skill-ranking-title">
      {header}

      {members.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No active members to rate yet.
        </p>
      ) : (
        <>
          <p className="bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {ratedCount} of {members.length} rated
          </p>
          <ul className="divide-y divide-border">
            {sortedMembers.map(member => (
              <RatingRow
                key={member.userId}
                member={member}
                rating={draft[member.userId] ?? null}
                disabled={controlsDisabled}
                onChange={rating => handleRatingChange(member.userId, rating)}
              />
            ))}
          </ul>
        </>
      )}

      <div className="space-y-3 border-t border-border px-4 py-3">
        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-danger-wash/20 p-3 text-sm text-danger"
          >
            <p className="min-w-[12rem] flex-1">
              {SKILL_RANKING_CONFLICT_MESSAGE}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(clubId)}
            >
              Reload
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            onClick={() => void handleSave()}
            loading={saving}
            aria-label="Save ratings"
            disabled={!dirty || conflict}
          >
            Save ratings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={!dirty || saving}
          >
            Discard changes
          </Button>
          <p className="min-w-0 text-sm" role="status" aria-live="polite">
            {justSaved && !dirty && (
              <span className="text-success">Ratings saved.</span>
            )}
            {saveError && <span className="text-danger">{saveError}</span>}
          </p>
        </div>
      </div>
    </Card>
  )
}

function RatingRow({
  member,
  rating,
  disabled,
  onChange,
}: {
  member: SkillRankingMemberDTO
  rating: SkillRating | null
  disabled: boolean
  onChange: (rating: SkillRating | null) => void
}) {
  const name = member.displayName
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-[10rem] flex-1">
        <div className="break-words text-sm font-medium text-foreground">
          {name}
        </div>
        {member.position && (
          <div className="break-words text-xs text-muted-foreground">
            {member.position}
          </div>
        )}
      </div>
      <Select
        value={rating === null ? NOT_RATED : String(rating)}
        onValueChange={value => {
          const next = Number(value)
          onChange(isSkillRating(next) ? next : null)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className="h-11 w-[8.5rem] shrink-0 sm:h-9"
          aria-label={`Rating for ${name}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_RATED}>Not rated</SelectItem>
          {RATING_OPTIONS.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  )
}
