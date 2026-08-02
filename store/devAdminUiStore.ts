'use client'

import { create } from 'zustand'
import { isLocalDev } from '@/lib/utils/localDev'

const STORAGE_KEY = 'soccerville.hideAdminUi'

interface DevAdminUiState {
  /** When true, admin UI is hidden so an admin can preview the player experience. */
  hideAdminUi: boolean
  hydrated: boolean
  hydrate: () => void
  setHideAdminUi: (hide: boolean) => void
  toggleHideAdminUi: () => void
}

export const useDevAdminUiStore = create<DevAdminUiState>((set, get) => ({
  hideAdminUi: false,
  hydrated: false,
  hydrate: () => {
    if (!isLocalDev() || typeof window === 'undefined') {
      set({ hydrated: true, hideAdminUi: false })
      return
    }
    set({
      hydrated: true,
      hideAdminUi: window.localStorage.getItem(STORAGE_KEY) === '1',
    })
  },
  setHideAdminUi: hide => {
    if (typeof window !== 'undefined' && isLocalDev()) {
      window.localStorage.setItem(STORAGE_KEY, hide ? '1' : '0')
    }
    set({ hideAdminUi: hide })
  },
  toggleHideAdminUi: () => {
    get().setHideAdminUi(!get().hideAdminUi)
  },
}))
