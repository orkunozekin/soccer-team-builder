import { describe, expect, it } from 'vitest'
import { isProfileComplete } from './profile'
import type { User } from '@/types/user'

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  return {
    uid: 'u1',
    email: 'u1@example.com',
    displayName: 'Player One',
    jerseyNumber: null,
    position: 'ST',
    role: 'user',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('isProfileComplete', () => {
  it('returns false when user is null or undefined', () => {
    expect(isProfileComplete(null)).toBe(false)
    expect(isProfileComplete(undefined)).toBe(false)
  })

  it('requires non-empty displayName and position', () => {
    expect(
      isProfileComplete(
        makeUser({
          displayName: 'Name',
          position: 'ST',
        })
      )
    ).toBe(true)

    expect(
      isProfileComplete(
        makeUser({
          displayName: '',
          position: 'ST',
        })
      )
    ).toBe(false)

    expect(
      isProfileComplete(
        makeUser({
          displayName: 'Name',
          position: ' ',
        })
      )
    ).toBe(false)
  })
})
