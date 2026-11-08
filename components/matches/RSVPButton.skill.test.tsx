import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RSVPButton } from './RSVPButton'
import { useAuthStore } from '@/store/authStore'
import { resetSkillAssessmentStore } from '@/store/skillAssessmentStore'
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

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /i'm in/i }))
  expect(screen.getByText('Select your position')).toBeInTheDocument()
}

// The questionnaire is switched off for now: admins rate players instead.
describe('RSVPButton with skill-balanced-teams on', () => {
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

  it.each([true, false])(
    'never asks the questionnaire (flag %s): confirms from the position step',
    async flagOn => {
      const user = userEvent.setup()
      flagMock.mockReturnValue(flagOn)
      getSkillMock.mockResolvedValue({ assessment: null })
      render(<RSVPButton match={match} />)

      await openModal(user)
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))

      expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
      expect(getSkillMock).not.toHaveBeenCalled()
      expect(saveSkillMock).not.toHaveBeenCalled()
      expect(screen.queryByText('Your game')).toBeNull()
    }
  )
})
