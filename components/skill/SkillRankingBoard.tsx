'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
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
import { SKILL_TIER_LABELS, emptySkillTiers } from '@/lib/skill/scoring'
import {
  type SkillBoardGroup,
  type TierMoveDirection,
  keepSkillTierMembers,
  moveToSkillTier,
  moveWithinSkillTier,
  skillTiersEqual,
  unrankedSkillMemberIds,
} from '@/lib/skill/tierMoves'
import {
  SKILL_TIER_KEYS,
  type SkillRankingMemberDTO,
  type SkillRankingTiers,
} from '@/types/skill'

export const SKILL_RANKING_CONFLICT_MESSAGE =
  'Another admin changed the ranking. Reload to see their changes.'

const GROUPS: readonly SkillBoardGroup[] = [...SKILL_TIER_KEYS, 'unranked']

const GROUP_LABELS: Record<SkillBoardGroup, string> = {
  ...SKILL_TIER_LABELS,
  unranked: 'Unranked',
}

type LoadStatus = 'loading' | 'error' | 'loaded'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function questionnaireHint(score: number | null): string {
  return score === null
    ? 'No questionnaire'
    : `Questionnaire ${score.toFixed(1)} / 4`
}

/**
 * Club admins' shared skill ranking (tiers ordered strongest first). Callers
 * must render it only for club admins with `skill-balanced-teams` on.
 */
export function SkillRankingBoard({ clubId }: { clubId: string }) {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [members, setMembers] = useState<SkillRankingMemberDTO[]>([])
  const [saved, setSaved] = useState<{
    tiers: SkillRankingTiers
    version: number
  } | null>(null)
  const [draft, setDraft] = useState<SkillRankingTiers>(emptySkillTiers)
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
        const tiers = keepSkillTierMembers(
          res.ranking.tiers,
          res.members.map(m => m.userId)
        )
        setMembers(res.members)
        setSaved({ tiers, version: res.ranking.version })
        setDraft(tiers)
        setConflict(false)
        setSaveError('')
        setJustSaved(false)
        setLoadStatus('loaded')
      })
      .catch((err: unknown) => {
        if (gen !== genRef.current) return
        setLoadError(errorMessage(err, 'Failed to load skill ranking'))
        setLoadStatus('error')
      })
  }, [])

  useEffect(() => {
    setMembers([])
    setSaved(null)
    setDraft(emptySkillTiers())
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

  const memberById = useMemo(
    () => new Map(members.map(m => [m.userId, m])),
    [members]
  )
  const dirty = saved !== null && !skillTiersEqual(draft, saved.tiers)

  const edit = (next: SkillRankingTiers) => {
    setDraft(next)
    setJustSaved(false)
    setSaveError('')
  }

  const handleTierChange = (userId: string, target: SkillBoardGroup) => {
    edit(moveToSkillTier(draft, userId, target))
  }

  const handleMove = (userId: string, direction: TierMoveDirection) => {
    edit(moveWithinSkillTier(draft, userId, direction))
  }

  const handleDiscard = () => {
    if (!saved) return
    edit(saved.tiers)
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
        tiers: draft,
        version: saved.version,
      })
      if (gen !== genRef.current) return
      const tiers = keepSkillTierMembers(res.ranking.tiers, memberIds)
      setSaved({ tiers, version: res.ranking.version })
      setDraft(tiers)
      setJustSaved(true)
    } catch (err: unknown) {
      if (gen !== genRef.current) return
      if ((err as { status?: number }).status === 409) {
        setConflict(true)
      } else {
        setSaveError(errorMessage(err, 'Failed to save skill ranking'))
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
          Skill ranking
        </h2>
        {dirty && <StatusPill tone="neutral">Unsaved changes</StatusPill>}
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Admins only
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Rebalance teams uses this ranking. Order each tier strongest first;
        unranked players are placed by their questionnaire.
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
        <div className="space-y-3 px-4 py-4" aria-label="Loading skill ranking">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-24" />
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

  const memberIds = members.map(m => m.userId)
  const controlsDisabled = saving || conflict

  return (
    <Card className="overflow-hidden" aria-labelledby="skill-ranking-title">
      {header}

      {members.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No active members to rank yet.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {GROUPS.map(group => {
            const ids =
              group === 'unranked'
                ? unrankedSkillMemberIds(draft, memberIds)
                : draft[group]
            const rows = ids.flatMap(uid => {
              const member = memberById.get(uid)
              return member ? [member] : []
            })
            const headingId = `skill-group-${group}`
            return (
              <section key={group} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="flex items-center gap-2 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {GROUP_LABELS[group]}
                  <span className="font-normal">({rows.length})</span>
                </h3>
                {rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {group === 'unranked'
                      ? 'Everyone is ranked.'
                      : 'No players in this tier.'}
                  </p>
                ) : (
                  <ol className="divide-y divide-border">
                    {rows.map((member, index) => (
                      <RankingRow
                        key={member.userId}
                        member={member}
                        group={group}
                        index={index}
                        count={rows.length}
                        disabled={controlsDisabled}
                        onTierChange={target =>
                          handleTierChange(member.userId, target)
                        }
                        onMove={direction =>
                          handleMove(member.userId, direction)
                        }
                      />
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
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
            aria-label="Save ranking"
            disabled={!dirty || conflict}
          >
            Save ranking
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
              <span className="text-success">Ranking saved.</span>
            )}
            {saveError && <span className="text-danger">{saveError}</span>}
          </p>
        </div>
      </div>
    </Card>
  )
}

function RankingRow({
  member,
  group,
  index,
  count,
  disabled,
  onTierChange,
  onMove,
}: {
  member: SkillRankingMemberDTO
  group: SkillBoardGroup
  index: number
  count: number
  disabled: boolean
  onTierChange: (target: SkillBoardGroup) => void
  onMove: (direction: TierMoveDirection) => void
}) {
  const ranked = group !== 'unranked'
  const name = member.displayName
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="flex min-w-[10rem] flex-1 items-start gap-3">
        {ranked && (
          <span
            className="w-6 shrink-0 pt-0.5 text-right font-mono text-sm text-muted-foreground"
            aria-hidden="true"
          >
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-medium text-foreground">
            {name}
          </div>
          <div className="break-words text-xs text-muted-foreground">
            {[member.position, questionnaireHint(member.assessmentScore)]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={group}
          onValueChange={(value: SkillBoardGroup) => onTierChange(value)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-9 w-[8.5rem] shrink-0"
            aria-label={`Tier for ${name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map(option => (
              <SelectItem key={option} value={option}>
                {GROUP_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ranked && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${name} up`}
              disabled={disabled || index === 0}
              onClick={() => onMove('up')}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${name} down`}
              disabled={disabled || index === count - 1}
              onClick={() => onMove('down')}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
