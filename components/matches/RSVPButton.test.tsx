import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Match } from '@/types/match'
import { RSVPButton } from './RSVPButton'

const confirmRSVPAPIMock = vi.fn()
const cancelRSVPAPIMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  confirmRSVPAPI: (...args: unknown[]) => confirmRSVPAPIMock(...args),
  cancelRSVPAPI: (...args: unknown[]) => cancelRSVPAPIMock(...args),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useMatchStoreMock = vi.fn()
vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => useMatchStoreMock(),
}))

const isProfileCompleteMock = vi.fn()
vi.mock('@/lib/utils/profile', () => ({
  isProfileComplete: (...args: unknown[]) => isProfileCompleteMock(...args),
}))

vi.mock('@/lib/services/rsvpService', () => ({
  getUserRSVP: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: () => <div>PositionSelector</div>,
}))

vi.mock('@/components/profile/ProfileCompleteModal', () => ({
  ProfileCompleteModal: (props: { open: boolean }) =>
    props.open ? <div>Profile modal open</div> : null,
}))

const baseMatch: Match = {
  id: 'match1',
  date: new Date('2024-01-01T00:00:00Z'),
  time: '19:00',
  location: 'Test field',
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('RSVPButton', () => {
  it('renders primary button when RSVP is open', () => {
    useAuthMock.mockReturnValue({
      user: null,
      userData: null,
    })
    useMatchStoreMock.mockReturnValue({
      matchRSVPs: [],
      addRSVP: vi.fn(),
      removeRSVP: vi.fn(),
    })
    isProfileCompleteMock.mockReturnValue(false)

    render(<RSVPButton match={baseMatch} />)

    expect(
      screen.getByRole('button', { name: /rsvp to match/i })
    ).toBeInTheDocument()
  })

  it('opens profile modal when profile is incomplete', async () => {
    const user = userEvent.setup()

    useAuthMock.mockReturnValue({
      user: { uid: 'user1' } as any,
      userData: { uid: 'user1' } as any,
    })
    useMatchStoreMock.mockReturnValue({
      matchRSVPs: [],
      addRSVP: vi.fn(),
      removeRSVP: vi.fn(),
    })
    isProfileCompleteMock.mockReturnValue(false)

    render(<RSVPButton match={baseMatch} />)

    await user.click(
      screen.getByRole('button', { name: /rsvp to match/i })
    )

    expect(screen.getByText(/profile modal open/i)).toBeInTheDocument()
  })

  it('calls confirmRSVPAPI and toggles to Cancel RSVP when profile is complete', async () => {
    const user = userEvent.setup()

    useAuthMock.mockReturnValue({
      user: { uid: 'user1' } as any,
      userData: { uid: 'user1', displayName: 'Player', position: 'ST' } as any,
    })
    useMatchStoreMock.mockReturnValue({
      matchRSVPs: [],
      addRSVP: vi.fn(),
      removeRSVP: vi.fn(),
    })
    isProfileCompleteMock.mockReturnValue(true)
    confirmRSVPAPIMock.mockResolvedValue({
      rsvpId: 'r1',
      regenerated: false,
      position: 'ST',
    })

    render(<RSVPButton match={baseMatch} />)

    await user.click(
      screen.getByRole('button', { name: /rsvp to match/i })
    )

    expect(confirmRSVPAPIMock).toHaveBeenCalledWith('match1', undefined)
    expect(
      screen.getByRole('button', { name: /cancel rsvp/i })
    ).toBeInTheDocument()
  })
})

