import type { User as FirebaseUser } from 'firebase/auth'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'
import type { User } from '@/types/user'

function profile(uid: string, patch: Partial<User> = {}): User {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    jerseyNumber: null,
    position: null,
    role: 'user',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...patch,
  }
}

function signIn(uid: string, patch: Partial<User> = {}) {
  useAuthStore.setState({
    user: { uid, email: `${uid}@example.com` } as FirebaseUser,
    userData: profile(uid, patch),
    profileReady: true,
  })
}

describe('authStore.mergeUserData', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, userData: null, profileReady: false })
  })

  it('merges into the current profile, keeping fields written meanwhile', () => {
    signIn('u1')
    // A concurrent writer lands first…
    useAuthStore.getState().mergeUserData('u1', { themePreference: 'light' })
    // …then another writer merges its own fields.
    useAuthStore.getState().mergeUserData('u1', { displayName: 'Pat' })

    expect(useAuthStore.getState().userData).toMatchObject({
      uid: 'u1',
      displayName: 'Pat',
      themePreference: 'light',
    })
  })

  it('ignores a merge for a user who is no longer signed in', () => {
    signIn('u2', { displayName: 'Sam' })

    useAuthStore.getState().mergeUserData('u1', { displayName: 'Pat' })

    expect(useAuthStore.getState().userData).toMatchObject({
      uid: 'u2',
      displayName: 'Sam',
    })
  })

  it('ignores a merge while the store still holds another user’s profile', () => {
    useAuthStore.setState({
      user: { uid: 'u2' } as FirebaseUser,
      userData: profile('u1'),
    })

    useAuthStore.getState().mergeUserData('u2', { displayName: 'Sam' })

    expect(useAuthStore.getState().userData).toMatchObject({
      uid: 'u1',
      displayName: 'u1',
    })
  })
})
