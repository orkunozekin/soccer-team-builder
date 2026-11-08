'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getClubSkillRankingAPI } from '@/lib/api/client'
import type { ClubSkillRankingDTO, SkillRatings } from '@/types/skill'

export type ClubSkillRatingsStatus = 'idle' | 'loading' | 'loaded' | 'error'

type State = {
  clubId: string | null
  status: ClubSkillRatingsStatus
  ratings: SkillRatings
  memberIds: ReadonlySet<string>
}

const EMPTY: State = {
  clubId: null,
  status: 'idle',
  ratings: {},
  memberIds: new Set(),
}

/**
 * A club's admin ratings and active member ids, for club admins. Pass
 * `clubId: null` to skip loading (not an admin, flag off, no club). Results
 * for an earlier club, or after unmount, are dropped.
 */
export function useClubSkillRatings(clubId: string | null) {
  const [state, setState] = useState<State>(EMPTY)
  const genRef = useRef(0)

  const load = useCallback((targetClubId: string) => {
    const gen = ++genRef.current
    setState(current => ({
      ...(current.clubId === targetClubId ? current : EMPTY),
      clubId: targetClubId,
      status: 'loading',
    }))
    void getClubSkillRankingAPI(targetClubId)
      .then(res => {
        if (gen !== genRef.current) return
        setState({
          clubId: targetClubId,
          status: 'loaded',
          ratings: res.ranking.ratings,
          memberIds: new Set(res.members.map(m => m.userId)),
        })
      })
      .catch(() => {
        if (gen !== genRef.current) return
        setState(current => ({ ...current, status: 'error' }))
      })
  }, [])

  useEffect(() => {
    if (!clubId) {
      genRef.current++
      setState(EMPTY)
      return
    }
    load(clubId)
    return () => {
      genRef.current++
    }
  }, [clubId, load])

  const retry = useCallback(() => {
    if (clubId) load(clubId)
  }, [clubId, load])

  /** Adopt the merged ratings a save returned. */
  const applySaved = useCallback(
    (ranking: ClubSkillRankingDTO) => {
      // A load still in flight predates this save.
      genRef.current++
      setState(current =>
        current.clubId === clubId
          ? { ...current, status: 'loaded', ratings: ranking.ratings }
          : current
      )
    },
    [clubId]
  )

  const mine = state.clubId === clubId
  return {
    status: mine ? state.status : ('idle' as const),
    ratings: mine ? state.ratings : EMPTY.ratings,
    memberIds: mine ? state.memberIds : EMPTY.memberIds,
    retry,
    applySaved,
  }
}
