import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuthStore } from '@/store/authStore'

const { getDocumentMock, listenerRef } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
  listenerRef: {
    current: null as null | ((user: unknown) => Promise<void>),
  },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (
    _auth: unknown,
    callback: (user: unknown) => Promise<void>
  ) => {
    listenerRef.current = callback
    return () => {
      listenerRef.current = null
    }
  },
}))

vi.mock('@/lib/firebase/config', () => ({
  auth: {},
}))

vi.mock('@/lib/firebase/firestore', () => ({
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
  timestampToDate: () => new Date('2026-01-01T00:00:00Z'),
}))

vi.mock('@/lib/services/userService', () => ({
  createUser: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  recordAuditEventAPI: vi.fn(),
  updateProfileAPI: vi.fn(),
}))

function superUserDoc() {
  return {
    role: 'super_user',
    email: 'alex@test.soccer',
    displayName: 'Alex',
    jerseyNumber: null,
    position: null,
    activeClubId: 'club-a',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('AuthProvider profile readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listenerRef.current = null
    useAuthStore.setState({
      user: null,
      userData: null,
      loading: true,
      profileReady: false,
    })
  })

  it('does not treat a signed-out profile as ready for the next sign-in', async () => {
    let resolveDoc: (doc: unknown) => void = () => {}
    getDocumentMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveDoc = resolve
        })
    )

    render(
      <AuthProvider>
        <span>app</span>
      </AuthProvider>
    )

    await listenerRef.current?.(null)
    expect(useAuthStore.getState().profileReady).toBe(true)
    expect(useAuthStore.getState().user).toBeNull()

    const pending = listenerRef.current?.({
      uid: 'super-1',
      email: 'alex@test.soccer',
      displayName: 'Alex',
    })

    expect(useAuthStore.getState().profileReady).toBe(false)
    expect(useAuthStore.getState().userData).toBeNull()
    expect(useAuthStore.getState().user?.uid).toBe('super-1')

    resolveDoc(superUserDoc())
    await pending

    await waitFor(() => {
      expect(useAuthStore.getState().profileReady).toBe(true)
    })
    expect(useAuthStore.getState().userData?.role).toBe('super_user')
    expect(useAuthStore.getState().userData?.uid).toBe('super-1')
  })

  it('keeps the current profile ready across a same-user auth callback', async () => {
    getDocumentMock.mockResolvedValue(superUserDoc())

    render(
      <AuthProvider>
        <span>app</span>
      </AuthProvider>
    )

    await listenerRef.current?.({
      uid: 'super-1',
      email: 'alex@test.soccer',
      displayName: 'Alex',
    })

    expect(useAuthStore.getState().profileReady).toBe(true)

    let resolveRefresh: (doc: unknown) => void = () => {}
    getDocumentMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRefresh = resolve
        })
    )

    const refresh = listenerRef.current?.({
      uid: 'super-1',
      email: 'alex@test.soccer',
      displayName: 'Alex',
    })

    expect(useAuthStore.getState().profileReady).toBe(true)
    expect(useAuthStore.getState().userData?.role).toBe('super_user')

    resolveRefresh(superUserDoc())
    await refresh
  })
})