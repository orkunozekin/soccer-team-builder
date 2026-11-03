'use client'

import { User as FirebaseUser } from 'firebase/auth'
import { create } from 'zustand'
import { User } from '@/types/user'

interface AuthState {
  user: FirebaseUser | null
  userData: User | null
  loading: boolean
  /** True after the user-doc fetch for the current auth callback has finished. */
  profileReady: boolean
  setUser: (user: FirebaseUser | null) => void
  setUserData: (userData: User | null) => void
  /**
   * Merge fields into the profile as it is now (not a snapshot taken before
   * an `await`), and only if it still belongs to `uid`. Use this after an
   * async profile write so concurrent writers (theme toggle, club switch,
   * profile form) don't overwrite each other's fields.
   */
  mergeUserData: (uid: string, patch: Partial<User>) => void
  setLoading: (loading: boolean) => void
  setProfileReady: (profileReady: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userData: null,
  loading: true,
  profileReady: false,
  setUser: user => {
    const prev = get().user
    // Skip no-op updates so pages that depend on auth identity do not
    // re-run fetches when Firebase hands us a new object for the same user.
    if (prev?.uid === user?.uid && prev?.email === user?.email) {
      return
    }
    set({ user })
  },
  setUserData: userData => set({ userData }),
  mergeUserData: (uid, patch) => {
    const { user, userData } = get()
    if (user?.uid !== uid || userData?.uid !== uid) return
    set({ userData: { ...userData, ...patch } })
  },
  setLoading: loading => set({ loading }),
  setProfileReady: profileReady => set({ profileReady }),
  logout: () => set({ user: null, userData: null, profileReady: false }),
}))
