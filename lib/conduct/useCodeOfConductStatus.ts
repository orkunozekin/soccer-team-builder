'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getMyCodeOfConductStatusAPI } from '@/lib/api/client'

/**
 * Code of conduct step in the RSVP flow:
 * - `'none'`: no step (club doesn't require it, or the member already agreed)
 * - `'checking'`: still finding out
 * - `'required'`: the member must agree before the RSVP is sent
 */
export type CodeOfConductStepMode = 'none' | 'checking' | 'required'

type Settled = { key: string; mode: Exclude<CodeOfConductStepMode, 'checking'> }

/**
 * Whether the signed-in member must agree to the code of conduct before
 * RSVPing to a match of `clubId`. The RSVP API is the real gate; if this
 * lookup fails we show no step, and a 403 from the RSVP calls
 * `markRequired()` to bring the step up.
 */
export function useCodeOfConductStatus(
  uid: string | null,
  clubId: string | null | undefined
) {
  const key = uid && clubId ? `${uid}|${clubId}` : null
  const [settled, setSettled] = useState<Settled | null>(null)
  const generation = useRef(0)

  useEffect(() => {
    if (!key || !clubId) return
    const gen = ++generation.current
    getMyCodeOfConductStatusAPI(clubId).then(
      status => {
        if (gen !== generation.current) return
        setSettled({ key, mode: status.required ? 'required' : 'none' })
      },
      () => {
        if (gen !== generation.current) return
        setSettled({ key, mode: 'none' })
      }
    )
    return () => {
      generation.current++
    }
  }, [key, clubId])

  const settle = useCallback(
    (mode: Settled['mode']) => {
      if (!key) return
      // Drop any lookup still in flight; this answer is newer.
      generation.current++
      setSettled({ key, mode })
    },
    [key]
  )
  const markAgreed = useCallback(() => settle('none'), [settle])
  const markRequired = useCallback(() => settle('required'), [settle])

  const mode: CodeOfConductStepMode = !key
    ? 'none'
    : settled?.key === key
      ? settled.mode
      : 'checking'

  return { mode, markAgreed, markRequired }
}
