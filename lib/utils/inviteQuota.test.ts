import { describe, expect, it } from 'vitest'
import { PLAYER_INVITE_COOLDOWN_MS } from '@/lib/constants/invites'
import {
  formatInviteTimeRemaining,
  getInviteQuotaState,
} from '@/lib/utils/inviteQuota'

const created = new Date('2026-09-30T12:00:00Z')

describe('getInviteQuotaState', () => {
  it('allows a player with no prior invite', () => {
    expect(
      getInviteQuotaState({
        lastCreatedAt: null,
        lastInviteRevoked: false,
        now: created,
      })
    ).toEqual({ limited: false, nextAllowedAt: null })
  })

  it('limits a player inside the cooldown window', () => {
    const now = new Date(created.getTime() + 60 * 60 * 1000)
    expect(
      getInviteQuotaState({
        lastCreatedAt: created,
        lastInviteRevoked: false,
        now,
      })
    ).toEqual({
      limited: true,
      nextAllowedAt: new Date(created.getTime() + PLAYER_INVITE_COOLDOWN_MS),
    })
  })

  it('allows a player once the cooldown has fully elapsed', () => {
    const now = new Date(created.getTime() + PLAYER_INVITE_COOLDOWN_MS)
    expect(
      getInviteQuotaState({
        lastCreatedAt: created,
        lastInviteRevoked: false,
        now,
      }).limited
    ).toBe(false)
  })

  it('frees the slot when the last invite was revoked', () => {
    expect(
      getInviteQuotaState({
        lastCreatedAt: created,
        lastInviteRevoked: true,
        now: created,
      })
    ).toEqual({ limited: false, nextAllowedAt: null })
  })
})

describe('formatInviteTimeRemaining', () => {
  const at = (ms: number) => new Date(created.getTime() + ms)

  it('formats hours and minutes', () => {
    expect(
      formatInviteTimeRemaining(at((11 * 60 + 42) * 60_000 + 30_000), created)
    ).toBe('11h 42m')
  })

  it('formats minutes only under an hour', () => {
    expect(formatInviteTimeRemaining(at(42 * 60_000), created)).toBe('42m')
  })

  it('reports less than a minute', () => {
    expect(formatInviteTimeRemaining(at(30_000), created)).toBe(
      'Less than a minute'
    )
  })

  it('returns null once the target has passed', () => {
    expect(formatInviteTimeRemaining(created, created)).toBeNull()
    expect(formatInviteTimeRemaining(at(-1), created)).toBeNull()
  })
})
