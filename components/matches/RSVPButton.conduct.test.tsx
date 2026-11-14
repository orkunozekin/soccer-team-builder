import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RSVPButton } from './RSVPButton'
import {
  CODE_OF_CONDUCT_REQUIRED_CODE,
  CODE_OF_CONDUCT_REQUIRED_MESSAGE,
  CODE_OF_CONDUCT_VERSION,
} from '@/lib/conduct/codeOfConduct'
import type { Match } from '@/types/match'

// Real RSVPPositionModal + real useCodeOfConductStatus; only the network,
// auth hook and stores are mocked.

const confirmRSVPAPIMock = vi.fn()
const statusMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  confirmRSVPAPI: (...args: unknown[]) => confirmRSVPAPIMock(...args),
  cancelRSVPAPI: vi.fn(),
  getMyCodeOfConductStatusAPI: (...args: unknown[]) => statusMock(...args),
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
  clubId: 'club1',
  date: new Date('2099-06-15T00:00:00Z'),
  time: '19:00',
  location: { name: 'Field', address: 'Field', lat: 30, lng: -97 },
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function conductRequiredError() {
  return Object.assign(new Error(CODE_OF_CONDUCT_REQUIRED_MESSAGE), {
    status: 403,
    code: CODE_OF_CONDUCT_REQUIRED_CODE,
  })
}

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /i'm in/i }))
  expect(screen.getByText('Select your position')).toBeInTheDocument()
}

async function agreeAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Next' }))
  expect(screen.getByText('Code of conduct')).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: /i agree to follow/i }))
  await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
}

describe('RSVPButton code of conduct', () => {
  beforeEach(() => {
    confirmRSVPAPIMock.mockReset()
    statusMock.mockReset()
    confirmRSVPAPIMock.mockResolvedValue({
      rsvpId: 'r1',
      regenerated: false,
      position: 'ST',
    })
  })

  it('asks once when the club requires it, then sends the agreement', async () => {
    const user = userEvent.setup()
    statusMock.mockResolvedValue({ required: true, agreement: null })
    render(<RSVPButton match={match} />)

    await openModal(user)
    await agreeAndConfirm(user)

    expect(statusMock).toHaveBeenCalledWith('club1')
    expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST', null, {
      acceptCodeOfConductVersion: CODE_OF_CONDUCT_VERSION,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('skips the step when not required', async () => {
    const user = userEvent.setup()
    statusMock.mockResolvedValue({ required: false, agreement: null })
    render(<RSVPButton match={match} />)

    await openModal(user)
    await user.click(
      await screen.findByRole('button', { name: 'Confirm RSVP' })
    )
    expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', 'ST')
  })

  it('brings the step up when the server asks for it', async () => {
    const user = userEvent.setup()
    // Lookup failed: no step shown, the server is the real gate.
    statusMock.mockRejectedValue(new Error('offline'))
    confirmRSVPAPIMock.mockRejectedValueOnce(conductRequiredError())
    render(<RSVPButton match={match} />)

    await openModal(user)
    await user.click(
      await screen.findByRole('button', { name: 'Confirm RSVP' })
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      CODE_OF_CONDUCT_REQUIRED_MESSAGE
    )
    await agreeAndConfirm(user)
    expect(confirmRSVPAPIMock).toHaveBeenLastCalledWith('match1', 'ST', null, {
      acceptCodeOfConductVersion: CODE_OF_CONDUCT_VERSION,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks again when the RSVP carrying the agreement failed', async () => {
    const user = userEvent.setup()
    statusMock.mockResolvedValue({ required: true, agreement: null })
    confirmRSVPAPIMock.mockRejectedValueOnce(new Error('Network down'))
    render(<RSVPButton match={match} />)

    await openModal(user)
    await agreeAndConfirm(user)
    await openModal(user)
    expect(await screen.findByRole('button', { name: 'Next' })).toBeEnabled()
    await agreeAndConfirm(user)
    expect(confirmRSVPAPIMock).toHaveBeenCalledTimes(2)
  })
})
