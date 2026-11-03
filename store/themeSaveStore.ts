'use client'

import { create } from 'zustand'

export const THEME_SAVE_ERROR = 'Couldn’t save your theme. Try again.'

interface ThemeSaveState {
  /** Bumped per save; only the latest save may touch shared state. */
  requestId: number
  /** uid whose save is in flight, or null. */
  pendingUid: string | null
  /** Last failed save, scoped to the uid it belongs to. */
  error: { uid: string; message: string } | null
  /**
   * Bumped after a failed save's rollback so `ThemeSync` re-resolves the
   * theme from the current flag and profile (e.g. the flag turned off while
   * the save was pending → dark, not the pre-click theme).
   */
  resyncCount: number
}

const initialState: ThemeSaveState = {
  requestId: 0,
  pendingUid: null,
  error: null,
  resyncCount: 0,
}

/**
 * Theme-save state shared by every `ThemeToggle` (desktop rail and mobile
 * sheet) and kept outside React, so a save that outlives its toggle (the
 * sheet closes) is still ordered and guarded against later saves and
 * account switches.
 */
export const useThemeSaveStore = create<ThemeSaveState>(() => initialState)

export function resetThemeSaveStore() {
  useThemeSaveStore.setState(initialState)
}
