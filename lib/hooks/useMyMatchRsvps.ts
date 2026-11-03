'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getUserRSVPs } from '@/lib/services/rsvpService'
import { indexConfirmedRsvps } from '@/lib/utils/playerMatchList'
import type { RSVP } from '@/types/rsvp'

export type MyMatchRsvpsState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  byMatchId: ReadonlyMap<string, RSVP>
}

const EMPTY: ReadonlyMap<string, RSVP> = new Map()

/**
 * The signed-in player's confirmed RSVPs, keyed by match id. A secondary
 * fetch: failures surface as `status: 'error'` (with `retry`) and never
 * affect the match list itself. Generation-guarded so a stale response for
 * a previous user cannot overwrite the current one.
 */
export function useMyMatchRsvps(userId: string | undefined, enabled = true) {
  const [state, setState] = useState<MyMatchRsvpsState>({
    status: 'idle',
    byMatchId: EMPTY,
  })
  const gen = useRef(0)

  const load = useCallback(async () => {
    const current = ++gen.current
    if (!userId || !enabled) {
      setState({ status: 'idle', byMatchId: EMPTY })
      return
    }
    setState(prev => ({ status: 'loading', byMatchId: prev.byMatchId }))
    try {
      const rsvps = await getUserRSVPs(userId)
      if (current !== gen.current) return
      setState({ status: 'ready', byMatchId: indexConfirmedRsvps(rsvps) })
    } catch (error) {
      if (current !== gen.current) return
      console.error('Failed to load your RSVPs:', error)
      setState({ status: 'error', byMatchId: EMPTY })
    }
  }, [userId, enabled])

  useEffect(() => {
    void load()
    return () => {
      gen.current++
    }
  }, [load])

  return { ...state, retry: load }
}
