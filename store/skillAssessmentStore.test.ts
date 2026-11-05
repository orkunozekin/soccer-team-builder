import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSkillAssessmentSaveStatus,
  loadSkillAssessment,
  resetSkillAssessmentStore,
  saveSkillAssessment,
  useSkillAssessment,
  useSkillAssessmentStore,
} from './skillAssessmentStore'
import { useAuthStore } from '@/store/authStore'
import type { SkillAnswers, SkillAssessmentDTO } from '@/types/skill'

const getMock = vi.fn()
const saveMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  getMySkillAssessmentAPI: (...args: unknown[]) => getMock(...args),
  saveMySkillAssessmentAPI: (...args: unknown[]) => saveMock(...args),
}))

const ANSWERS_A: SkillAnswers = {
  firstTouch: 3,
  passing: 3,
  fitness: 3,
  gameSense: 3,
}
const ANSWERS_B: SkillAnswers = {
  firstTouch: 1,
  passing: 1,
  fitness: 1,
  gameSense: 1,
}

function dto(answers: SkillAnswers): SkillAssessmentDTO {
  return { answers, updatedAt: '2026-11-01T00:00:00.000Z' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function signIn(uid: string | null) {
  useAuthStore.setState({ user: uid ? ({ uid } as never) : null })
}

describe('skillAssessmentStore', () => {
  beforeEach(() => {
    getMock.mockReset()
    saveMock.mockReset()
    resetSkillAssessmentStore()
    signIn('userA')
  })

  it('loads once per uid', async () => {
    getMock.mockResolvedValue({ assessment: dto(ANSWERS_A) })
    await loadSkillAssessment('userA')
    await loadSkillAssessment('userA')
    expect(getMock).toHaveBeenCalledTimes(1)
    const state = useSkillAssessmentStore.getState()
    expect(state.loadStatus).toBe('loaded')
    expect(state.assessment?.answers).toEqual(ANSWERS_A)
  })

  it('retries after a load error', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'))
    await loadSkillAssessment('userA')
    expect(useSkillAssessmentStore.getState().loadStatus).toBe('error')

    getMock.mockResolvedValueOnce({ assessment: null })
    await loadSkillAssessment('userA', { force: true })
    expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
    expect(useSkillAssessmentStore.getState().assessment).toBeNull()
  })

  it('drops a load for the previous uid after an account switch', async () => {
    const loadA = deferred<{ assessment: SkillAssessmentDTO | null }>()
    getMock.mockReturnValueOnce(loadA.promise)
    const pendingA = loadSkillAssessment('userA')

    signIn('userB')
    getMock.mockResolvedValueOnce({ assessment: null })
    await loadSkillAssessment('userB')

    loadA.resolve({ assessment: dto(ANSWERS_A) })
    await pendingA

    const state = useSkillAssessmentStore.getState()
    expect(state.uid).toBe('userB')
    expect(state.loadStatus).toBe('loaded')
    expect(state.assessment).toBeNull()
  })

  it('never exposes answers loaded for another uid', async () => {
    getMock.mockResolvedValue({ assessment: dto(ANSWERS_A) })
    await loadSkillAssessment('userA')

    const { result } = renderHook(() => useSkillAssessment('userB'))
    expect(result.current).toEqual({
      loadStatus: 'idle',
      assessment: null,
      saveStatus: 'idle',
    })
  })

  it('ignores a load that resolves after the user signed out, and reloads on sign-in', async () => {
    const loadA = deferred<{ assessment: SkillAssessmentDTO | null }>()
    getMock.mockReturnValueOnce(loadA.promise)
    const pending = loadSkillAssessment('userA')

    signIn(null)
    loadA.resolve({ assessment: dto(ANSWERS_A) })
    await pending
    expect(useSkillAssessmentStore.getState().assessment).toBeNull()
    expect(useSkillAssessmentStore.getState().loadStatus).toBe('idle')

    signIn('userA')
    getMock.mockResolvedValueOnce({ assessment: dto(ANSWERS_A) })
    await loadSkillAssessment('userA')
    expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
  })

  it('a save supersedes a load still in flight', async () => {
    const load = deferred<{ assessment: SkillAssessmentDTO | null }>()
    getMock.mockReturnValueOnce(load.promise)
    const pendingLoad = loadSkillAssessment('userA')

    saveMock.mockResolvedValueOnce({
      success: true,
      assessment: dto(ANSWERS_B),
    })
    await expect(saveSkillAssessment('userA', ANSWERS_B)).resolves.toBe(true)

    load.resolve({ assessment: dto(ANSWERS_A) })
    await pendingLoad

    const state = useSkillAssessmentStore.getState()
    expect(state.loadStatus).toBe('loaded')
    expect(state.assessment?.answers).toEqual(ANSWERS_B)
    expect(state.saveStatus).toBe('saved')
  })

  it('a failed save does not leave an in-flight load stuck loading', async () => {
    const load = deferred<{ assessment: SkillAssessmentDTO | null }>()
    getMock.mockReturnValueOnce(load.promise)
    const pendingLoad = loadSkillAssessment('userA')

    saveMock.mockRejectedValueOnce(new Error('nope'))
    await expect(saveSkillAssessment('userA', ANSWERS_B)).resolves.toBe(false)
    expect(useSkillAssessmentStore.getState().saveStatus).toBe('error')

    load.resolve({ assessment: null })
    await pendingLoad
    expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
  })

  it('sends overlapping saves one at a time, in order; the latest wins', async () => {
    getMock.mockResolvedValue({ assessment: null })
    await loadSkillAssessment('userA')

    const first = deferred<{
      success: boolean
      assessment: SkillAssessmentDTO
    }>()
    saveMock.mockReturnValueOnce(first.promise)
    const pendingFirst = saveSkillAssessment('userA', ANSWERS_A)

    saveMock.mockResolvedValueOnce({
      success: true,
      assessment: dto(ANSWERS_B),
    })
    const pendingSecond = saveSkillAssessment('userA', ANSWERS_B)

    // The second PUT waits for the first, so the server's last write is B.
    await Promise.resolve()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenLastCalledWith(ANSWERS_A)

    first.resolve({ success: true, assessment: dto(ANSWERS_A) })
    await expect(pendingFirst).resolves.toBe(false)
    await expect(pendingSecond).resolves.toBe(true)
    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(saveMock).toHaveBeenLastCalledWith(ANSWERS_B)

    const state = useSkillAssessmentStore.getState()
    expect(state.assessment?.answers).toEqual(ANSWERS_B)
    expect(state.saveStatus).toBe('saved')
  })

  it('a stale save failure cannot clear a newer save state', async () => {
    getMock.mockResolvedValue({ assessment: null })
    await loadSkillAssessment('userA')

    const first = deferred<never>()
    saveMock.mockReturnValueOnce(first.promise)
    const pendingFirst = saveSkillAssessment('userA', ANSWERS_A)

    const second = deferred<{
      success: boolean
      assessment: SkillAssessmentDTO
    }>()
    saveMock.mockReturnValueOnce(second.promise)
    const pendingSecond = saveSkillAssessment('userA', ANSWERS_B)

    first.reject(new Error('late failure'))
    await pendingFirst
    expect(useSkillAssessmentStore.getState().saveStatus).toBe('saving')
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2))

    second.resolve({ success: true, assessment: dto(ANSWERS_B) })
    await pendingSecond
    expect(useSkillAssessmentStore.getState().saveStatus).toBe('saved')
  })

  it('never sends a queued save after its user signed out', async () => {
    getMock.mockResolvedValue({ assessment: null })
    await loadSkillAssessment('userA')

    const first = deferred<{
      success: boolean
      assessment: SkillAssessmentDTO
    }>()
    saveMock.mockReturnValueOnce(first.promise)
    const pendingFirst = saveSkillAssessment('userA', ANSWERS_A)
    const pendingSecond = saveSkillAssessment('userA', ANSWERS_B)
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1))

    signIn('userB')
    first.resolve({ success: true, assessment: dto(ANSWERS_A) })
    await expect(pendingFirst).resolves.toBe(false)
    await expect(pendingSecond).resolves.toBe(false)

    // Sent now, the queued PUT would carry userB's token.
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it('drops a save that lands after an account switch', async () => {
    getMock.mockResolvedValue({ assessment: null })
    await loadSkillAssessment('userA')

    const save = deferred<{
      success: boolean
      assessment: SkillAssessmentDTO
    }>()
    saveMock.mockReturnValueOnce(save.promise)
    const pending = saveSkillAssessment('userA', ANSWERS_A)

    signIn('userB')
    await loadSkillAssessment('userB')

    save.resolve({ success: true, assessment: dto(ANSWERS_A) })
    await expect(pending).resolves.toBe(false)

    const state = useSkillAssessmentStore.getState()
    expect(state.uid).toBe('userB')
    expect(state.assessment).toBeNull()
    expect(state.saveStatus).toBe('idle')
  })

  it('a save is visible to every reader of the same uid', async () => {
    getMock.mockResolvedValue({ assessment: null })
    await loadSkillAssessment('userA')
    const { result } = renderHook(() => useSkillAssessment('userA'))
    expect(result.current.assessment).toBeNull()

    saveMock.mockResolvedValueOnce({
      success: true,
      assessment: dto(ANSWERS_A),
    })
    await act(async () => {
      await saveSkillAssessment('userA', ANSWERS_A)
    })
    expect(result.current.assessment?.answers).toEqual(ANSWERS_A)

    act(() => clearSkillAssessmentSaveStatus('userA'))
    expect(result.current.saveStatus).toBe('idle')
  })
})
