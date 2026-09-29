import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditMatchCard } from './EditMatchCard'
import type { Match } from '@/types/match'

vi.mock('@/lib/api/client', () => ({
  updateMatchAPI: vi.fn(),
  deleteMatchAPI: vi.fn(),
}))

vi.mock('@/components/admin/LocationPicker', () => ({
  LocationPicker: () => <div>LocationPickerMock</div>,
}))

vi.mock('@/components/admin/RSVPPollControls', () => ({
  RSVPPollControls: () => <div>RSVPPollControlsMock</div>,
}))

const match: Match = {
  id: 'match1',
  date: new Date('2099-06-15T00:00:00Z'),
  time: '19:00',
  location: {
    name: 'Test field',
    address: 'Test field',
    lat: 30.0,
    lng: -97.0,
  },
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('EditMatchCard', () => {
  it('shows the section description while collapsed', () => {
    render(<EditMatchCard matchId="match1" match={match} />)

    const trigger = screen.getByRole('button', { name: 'Manage match' })
    expect(trigger).toHaveAttribute('data-state', 'closed')
    expect(trigger).toHaveAccessibleDescription(
      'Edit date, time, location, and RSVP window.'
    )
    expect(screen.queryByText('LocationPickerMock')).not.toBeInTheDocument()
  })
})
