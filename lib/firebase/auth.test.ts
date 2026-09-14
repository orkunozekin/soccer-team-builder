import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'

vi.mock('./config', () => ({
  auth: {},
}))

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn() },
  GoogleAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updatePassword: vi.fn(),
  verifyBeforeUpdateEmail: vi.fn(),
}))

import { getAuthErrorMessage, hasPasswordProvider } from './auth'

describe('hasPasswordProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when password provider is linked', () => {
    const user = {
      providerData: [
        { providerId: 'google.com' },
        { providerId: 'password' },
      ],
    } as User

    expect(hasPasswordProvider(user)).toBe(true)
  })

  it('returns false for Google-only accounts', () => {
    const user = {
      providerData: [{ providerId: 'google.com' }],
    } as User

    expect(hasPasswordProvider(user)).toBe(false)
  })
})

describe('getAuthErrorMessage', () => {
  it('maps known Firebase auth codes', () => {
    expect(
      getAuthErrorMessage({ code: 'auth/wrong-password' }, 'fallback')
    ).toBe('Current password is incorrect.')
    expect(
      getAuthErrorMessage(
        { code: 'auth/invalid-credential' },
        'fallback',
        'login'
      )
    ).toBe('Incorrect email or password.')
    expect(
      getAuthErrorMessage({ code: 'auth/email-already-in-use' }, 'fallback')
    ).toBe(
      'An account with this email already exists. Try signing in instead.'
    )
    expect(
      getAuthErrorMessage({ code: 'auth/user-not-found' }, 'fallback', 'login')
    ).toBe('No account found with that email. Try creating an account.')
  })

  it('falls back for unknown errors', () => {
    expect(getAuthErrorMessage({ code: 'auth/unknown' }, 'fallback')).toBe(
      'fallback'
    )
    expect(getAuthErrorMessage(new Error('Custom'), 'fallback')).toBe('Custom')
  })
})
