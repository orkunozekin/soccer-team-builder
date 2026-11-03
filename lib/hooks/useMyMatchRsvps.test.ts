import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RSVP } from '@/types/rsvp'
import { useMyMatchRsvps } from './useMyMatchRsvps'

const getUserRSVPsMock = vi.fn()
vi.mock('@/lib/services/rsvpService', () => ({
  getUserRSVPs: (...args: unknown[]) => getUserRSVPsMock(...args),
}))

const rsvp = (matchId: string, userId = 'u1'): RSVP => ({
  id: `r_${matchId}`,
  matchId,
  userId,
  status: 'confirmed',
  position: 'ST',
  jerseyNumber: 10,
  attended: null,
  checkedInAt: null,
  checkInMethod: null,
  rsvpAt: new Date(),
  updatedAt: new Date(),
})

describe('useMyMatchRsvps', () => {
  beforeEach(() => getUserRSVPsMock.mockReset())

  it('indexes the confirmed RSVPs by match id', async () => {
    getUserRSVPsMock.mockResolvedValue([rsvp('m1')])
    const { result } = renderHook(() => useMyMatchRsvps('u1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.byMatchId.get('m1')?.position).toBe('ST')
    expect(getUserRSVPsMock).toHaveBeenCalledWith('u1')
  })

  it('reports errors without throwing and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getUserRSVPsMock.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useMyMatchRsvps('u1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.byMatchId.size).toBe(0)

    getUserRSVPsMock.mockResolvedValueOnce([rsvp('m2')])
    await act(async () => {
      await result.current.retry()
    })
    expect(result.current.status).toBe('ready')
    expect(result.current.byMatchId.has('m2')).toBe(true)
  })

  it('ignores a stale response after the user changes', async () => {
    let resolveFirst: (value: RSVP[]) => void = () => {}
    getUserRSVPsMock
      .mockReturnValueOnce(
        new Promise<RSVP[]>(resolve => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce([rsvp('mine', 'u2')])

    const { result, rerender } = renderHook(({ uid }) => useMyMatchRsvps(uid), {
      initialProps: { uid: 'u1' },
    })
    rerender({ uid: 'u2' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => {
      resolveFirst([rsvp('stale', 'u1')])
    })
    expect(result.current.byMatchId.has('stale')).toBe(false)
    expect(result.current.byMatchId.has('mine')).toBe(true)
  })

  it('stays idle without a user', () => {
    const { result } = renderHook(() => useMyMatchRsvps(undefined))
    expect(result.current.status).toBe('idle')
    expect(getUserRSVPsMock).not.toHaveBeenCalled()
  })
})
