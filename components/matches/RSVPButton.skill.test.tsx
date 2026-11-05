import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RSVPButton } from './RSVPButton'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'
import { useAuthStore } from '@/store/authStore'
import {
  resetSkillAssessmentStore,
  useSkillAssessmentStore,
} from '@/store/skillAssessmentStore'
import type { Match } from '@/types/match'

// Real RSVPPositionModal + real skill assessment store; only the network,
// auth hook and flag are mocked.

const confirmRSVPAPIMock = vi.fn()
const getSkillMock = vi.fn()
const saveSkillMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  confirmRSVPAPI: (...args: unknown[]) => confirmRSVPAPIMock(...args),
  cancelRSVPAPI: vi.fn(),
  getMySkillAssessmentAPI: (...args: unknown[]) => getSkillMock(...args),
  saveMySkillAssessmentAPI: (...args: unknown[]) => saveSkillMock(...args),
}))

const flagMock = vi.fn()
vi.mock('@/lib/flags/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => flagMock(key),
  useFeatureFlagReady: () => true,
}))

const authValue = {
  user: { uid: 'user1' },
  userData: { uid: 'user1', displayName: 'Player', position: 'ST' },
}
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => authValue,
}))

vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useIsClubAdmin: () => ({
    isClubAdmin: false,
    isSuperUser: false,
    loading: false,
  }),
}))

const matchStoreValue = {
  matchRSVPs: [],
  addRSVP: vi.fn(),
  removeRSVP: vi.fn(),
}
vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => matchStoreValue,
}))

vi.mock('@/lib/utils/profile', () => ({
  isProfileComplete: () => true,
}))

vi.mock('@/lib/services/rsvpService', () => ({
  getUserRSVP: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: () => <div>PositionSelector</div>,
}))

vi.mock('@/components/profile/ProfileCompleteModal', () => ({
  ProfileCompleteModal: () => null,
}))

vi.mock('@/components/matches/RSVPSuccessCelebration', () => ({
  RSVPSuccessCelebration: () => null,
}))

const match: Match = {
  id: 'match1',
  date: new Date('2099-06-15T00:00:00Z'),
  time: '19:00',
  location: { name: 'Field', address: 'Field', lat: 30, lng: -97 },
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const SAVED = {
  answers: { firstTouch: 2, passing: 2, fitness: 2, gameSense: 2 },
  updatedAt: '2026-11-01T00:00:00.000Z',
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /i'm in/i }))
  expect(screen.getByText('Select your position')).toBeInTheDocument()
}

describe('RSVPButton skill step', () => {
  beforeEach(() => {
    confirmRSVPAPIMock.mockReset()
    getSkillMock.mockReset()
    saveSkillMock.mockReset()
    flagMock.mockReset()
    resetSkillAssessmentStore()
    useAuthStore.setState({ user: { uid: 'user1' } as never })
    confirmRSVPAPIMock.mockResolvedValue({
      rsvpId: 'r1',
      regenerated: false,
      position: 'ST',
    })
  })

  it('flag off: no questionnaire load, confirms from the position step', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(false)
    render(<RSVPButton match={match} />)

    await openModal(user)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))

    expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
    expect(getSkillMock).not.toHaveBeenCalled()
    expect(saveSkillMock).not.toHaveBeenCalled()
  })

  it('flag on, already answered: no skill step', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockResolvedValue({ assessment: SAVED })
    render(<RSVPButton match={match} />)
    await waitFor(() =>
      expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
    )

    await openModal(user)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
  })

  async function answerAllWith(
    user: ReturnType<typeof userEvent.setup>,
    optionIndex: 0 | 1 | 2
  ) {
    for (const question of SKILL_QUESTIONNAIRE) {
      await user.click(
        screen.getByRole('radio', {
          name: question.options[optionIndex].label,
        })
      )
    }
  }

  const ALL_THREES = { firstTouch: 3, passing: 3, fitness: 3, gameSense: 3 }

  it('flag on, never answered: no Skip; answers are saved before the RSVP is sent', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockResolvedValue({ assessment: null })
    let resolveSave!: (value: unknown) => void
    saveSkillMock.mockReturnValue(
      new Promise(resolve => {
        resolveSave = resolve
      })
    )
    render(<RSVPButton match={match} />)
    await waitFor(() =>
      expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
    )

    await openModal(user)
    expect(screen.queryByRole('button', { name: 'Confirm RSVP' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Your game')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm RSVP' })).toBeDisabled()

    await answerAllWith(user, 2)
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    expect(saveSkillMock).toHaveBeenCalledWith(ALL_THREES)
    // The RSVP waits for the save.
    expect(confirmRSVPAPIMock).not.toHaveBeenCalled()

    resolveSave({
      assessment: { answers: ALL_THREES, updatedAt: '2026-11-05T00:00:00Z' },
    })
    await waitFor(() =>
      expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
    )
    expect(
      await screen.findByRole('button', { name: /cancel rsvp/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a failed save blocks the RSVP, keeps the modal open, and a retry RSVPs', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockResolvedValue({ assessment: null })
    saveSkillMock.mockRejectedValueOnce(new Error('save failed'))
    render(<RSVPButton match={match} />)
    await waitFor(() =>
      expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
    )

    await openModal(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await answerAllWith(user, 2)
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn’t save your answers/i
    )
    expect(confirmRSVPAPIMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[2].label,
      })
    ).toBeChecked()

    saveSkillMock.mockResolvedValueOnce({
      assessment: { answers: ALL_THREES, updatedAt: '2026-11-05T00:00:00Z' },
    })
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    await waitFor(() =>
      expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
    )
    expect(saveSkillMock).toHaveBeenCalledTimes(2)
  })

  it('flag on, load failed: still requires the questionnaire', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockRejectedValue(new Error('down'))
    saveSkillMock.mockResolvedValue({
      assessment: { answers: ALL_THREES, updatedAt: '2026-11-05T00:00:00Z' },
    })
    render(<RSVPButton match={match} />)
    await waitFor(() =>
      expect(useSkillAssessmentStore.getState().loadStatus).toBe('error')
    )

    await openModal(user)
    expect(screen.queryByRole('button', { name: 'Confirm RSVP' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await answerAllWith(user, 2)
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    await waitFor(() =>
      expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
    )
    expect(saveSkillMock).toHaveBeenCalledWith(ALL_THREES)
  })

  it('flag on, still loading: cannot RSVP until we know whether the player answered', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockReturnValue(new Promise(() => {}))
    render(<RSVPButton match={match} />)

    await openModal(user)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Confirm RSVP' })).toBeNull()
    expect(confirmRSVPAPIMock).not.toHaveBeenCalled()
  })

  it('waits for an earlier save still in flight instead of letting the RSVP through', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getSkillMock.mockResolvedValue({ assessment: null })
    saveSkillMock.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<RSVPButton match={match} />)
    await waitFor(() =>
      expect(useSkillAssessmentStore.getState().loadStatus).toBe('loaded')
    )

    await openModal(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await answerAllWith(user, 0)
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    await waitFor(() => expect(saveSkillMock).toHaveBeenCalledTimes(1))
    unmount()

    // Another match while the first save is still pending.
    render(<RSVPButton match={{ ...match, id: 'match2' }} />)
    await openModal(user)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(confirmRSVPAPIMock).not.toHaveBeenCalled()
    expect(saveSkillMock).toHaveBeenCalledTimes(1)
  })
})
