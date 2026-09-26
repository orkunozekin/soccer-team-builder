'use client'

import { create } from 'zustand'
import type { ClubMembershipWithClub } from '@/types/club'

interface ClubMembershipsState {
  uid: string | null
  memberships: ClubMembershipWithClub[]
  loading: boolean
  error: string | null
  /** True after a successful fetch for the current uid */
  loaded: boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setMemberships: (
    uid: string,
    memberships: ClubMembershipWithClub[]
  ) => void
  clear: () => void
}

export const useClubMembershipsStore = create<ClubMembershipsState>(set => ({
  uid: null,
  memberships: [],
  loading: false,
  error: null,
  loaded: false,
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
  setMemberships: (uid, memberships) =>
    set({
      uid,
      memberships,
      loading: false,
      error: null,
      loaded: true,
    }),
  clear: () =>
    set({
      uid: null,
      memberships: [],
      loading: false,
      error: null,
      loaded: false,
    }),
}))
