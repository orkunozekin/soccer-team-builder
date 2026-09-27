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
  setLoading: loading => set({ loading }),
  setProfileReady: profileReady => set({ profileReady }),
  logout: () => set({ user: null, userData: null }),
}))
