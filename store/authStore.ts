'use client'

import { User as FirebaseUser } from 'firebase/auth'
import { create } from 'zustand'
import { User } from '@/types/user'

interface AuthState {
  user: FirebaseUser | null
  userData: User | null
  loading: boolean
  setUser: (user: FirebaseUser | null) => void
  setUserData: (userData: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  userData: null,
  loading: true,
  setUser: user => set({ user }),
  setUserData: userData => set({ userData }),
  setLoading: loading => set({ loading }),
  logout: () => set({ user: null, userData: null }),
}))
