'use client'

import { create } from 'zustand'
import {
  getMySkillAssessmentAPI,
  saveMySkillAssessmentAPI,
} from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import type { SkillAnswers, SkillAssessmentDTO } from '@/types/skill'

export const SKILL_ASSESSMENT_LOAD_ERROR =
  'Couldn’t load your questionnaire. Try again.'
export const SKILL_ASSESSMENT_SAVE_ERROR =
  'Couldn’t save your answers. Try again.'

export type SkillAssessmentLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'
export type SkillAssessmentSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SkillAssessmentState {
  /** uid every other field belongs to, or null before the first load. */
  uid: string | null
  loadStatus: SkillAssessmentLoadStatus
  /** The player's saved answers; null when they never answered (or not loaded). */
  assessment: SkillAssessmentDTO | null
  saveStatus: SkillAssessmentSaveStatus
  /** Bumped per load, on uid switch, and when a save lands; only the latest load may write. */
  loadRequestId: number
  /** Bumped per save and on uid switch; only the latest save may write. */
  saveRequestId: number
}

const initialState: SkillAssessmentState = {
  uid: null,
  loadStatus: 'idle',
  assessment: null,
  saveStatus: 'idle',
  loadRequestId: 0,
  saveRequestId: 0,
}

/**
 * The signed-in player's questionnaire, shared by the RSVP step and the
 * profile form so a save on one surface shows on the other. Kept outside
 * React so a save that outlives its component (the RSVP modal closes) is
 * still ordered against later loads, saves and account switches.
 */
export const useSkillAssessmentStore = create<SkillAssessmentState>(
  () => initialState
)

export function resetSkillAssessmentStore() {
  useSkillAssessmentStore.setState(initialState)
}

function isSignedIn(uid: string) {
  return useAuthStore.getState().user?.uid === uid
}

/** Point the store at `uid`, dropping anything held for another user. */
function scopeToUid(uid: string) {
  const state = useSkillAssessmentStore.getState()
  if (state.uid === uid) return
  useSkillAssessmentStore.setState({
    ...initialState,
    uid,
    loadRequestId: state.loadRequestId + 1,
    saveRequestId: state.saveRequestId + 1,
  })
}

/**
 * Load `uid`'s questionnaire once. Re-fetches only after an error, a uid
 * switch, or with `force`.
 */
export async function loadSkillAssessment(
  uid: string,
  { force = false }: { force?: boolean } = {}
): Promise<void> {
  if (!isSignedIn(uid)) return
  scopeToUid(uid)
  const state = useSkillAssessmentStore.getState()
  if (
    !force &&
    (state.loadStatus === 'loading' || state.loadStatus === 'loaded')
  ) {
    return
  }

  const requestId = state.loadRequestId + 1
  useSkillAssessmentStore.setState({
    loadRequestId: requestId,
    loadStatus: 'loading',
  })
  // Still the latest load for `uid`; if `uid` signed out meanwhile, drop the
  // result but go back to idle so a later sign-in loads again.
  const canWrite = () => {
    const current = useSkillAssessmentStore.getState()
    if (current.uid !== uid || current.loadRequestId !== requestId) {
      return false
    }
    if (isSignedIn(uid)) return true
    useSkillAssessmentStore.setState({ loadStatus: 'idle' })
    return false
  }

  try {
    const { assessment } = await getMySkillAssessmentAPI()
    if (!canWrite()) return
    useSkillAssessmentStore.setState({
      assessment: assessment ?? null,
      loadStatus: 'loaded',
    })
  } catch {
    if (!canWrite()) return
    useSkillAssessmentStore.setState({ loadStatus: 'error' })
  }
}

/**
 * Save `uid`'s answers. Never throws; resolves true when this save landed.
 * A successful save becomes the loaded state (superseding any load still in
 * flight). A failed save leaves the load state alone, so it never strands a
 * load in "loading".
 */
export async function saveSkillAssessment(
  uid: string,
  answers: SkillAnswers
): Promise<boolean> {
  if (!isSignedIn(uid)) return false
  scopeToUid(uid)
  const requestId = useSkillAssessmentStore.getState().saveRequestId + 1
  useSkillAssessmentStore.setState({
    saveRequestId: requestId,
    saveStatus: 'saving',
  })
  const canWrite = () => {
    const current = useSkillAssessmentStore.getState()
    if (current.uid !== uid || current.saveRequestId !== requestId) {
      return false
    }
    if (isSignedIn(uid)) return true
    useSkillAssessmentStore.setState({ saveStatus: 'idle' })
    return false
  }

  try {
    const { assessment } = await saveMySkillAssessmentAPI(answers)
    if (!canWrite()) return false
    useSkillAssessmentStore.setState(current => ({
      assessment,
      loadStatus: 'loaded',
      loadRequestId: current.loadRequestId + 1,
      saveStatus: 'saved',
    }))
    return true
  } catch {
    if (!canWrite()) return false
    useSkillAssessmentStore.setState({ saveStatus: 'error' })
    return false
  }
}

/** Clear a shown "saved"/"error" message (e.g. after the player edits answers). */
export function clearSkillAssessmentSaveStatus(uid: string) {
  const state = useSkillAssessmentStore.getState()
  if (state.uid !== uid || state.saveStatus === 'saving') return
  if (state.saveStatus !== 'idle') {
    useSkillAssessmentStore.setState({ saveStatus: 'idle' })
  }
}

export interface SkillAssessmentView {
  loadStatus: SkillAssessmentLoadStatus
  assessment: SkillAssessmentDTO | null
  saveStatus: SkillAssessmentSaveStatus
}

/**
 * Read the store for `uid`. Anything held for a different uid reads as
 * "idle" with no answers, so one account never sees another's.
 */
export function useSkillAssessment(
  uid: string | null | undefined
): SkillAssessmentView {
  const ownUid = useSkillAssessmentStore(s => s.uid)
  const loadStatus = useSkillAssessmentStore(s => s.loadStatus)
  const assessment = useSkillAssessmentStore(s => s.assessment)
  const saveStatus = useSkillAssessmentStore(s => s.saveStatus)
  if (!uid || ownUid !== uid) {
    return { loadStatus: 'idle', assessment: null, saveStatus: 'idle' }
  }
  return { loadStatus, assessment, saveStatus }
}
