import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import mapboxgl from 'mapbox-gl'
import { describe, expect, it, vi } from 'vitest'
import { EditMatchCard } from './EditMatchCard'
import type { Match } from '@/types/match'

vi.mock('@/lib/api/client', () => ({
  updateMatchAPI: vi.fn(),
  deleteMatchAPI: vi.fn(),
}))

vi.mock('@/lib/services/savedLocationService', () => ({
  getAllSavedLocations: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/dynamic', async () => {
  const { LocationMapPicker } = await import('./LocationMapPicker')
  return { default: () => LocationMapPicker }
})

vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => {
      throw new Error('Failed to initialize WebGL')
    }),
    NavigationControl: vi.fn(),
  },
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
    expect(screen.queryByLabelText('Location name')).not.toBeInTheDocument()
  })

  it('keeps match editing available when the map cannot initialize', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'test-token')
    try {
      const user = userEvent.setup()
      render(<EditMatchCard matchId="match1" match={match} />)

      await user.click(screen.getByRole('button', { name: 'Manage match' }))

      expect(await screen.findByText(/map unavailable/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Location name')).toHaveValue('Test field')
      expect(screen.getByLabelText('Address (optional)')).toHaveValue(
        'Test field'
      )
      expect(screen.getByRole('combobox', { name: 'Time' })).toHaveTextContent(
        '7:00 PM'
      )
      await user.type(screen.getByLabelText('Location name'), ' updated')
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Delete match' })).toBeEnabled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('cleans up a working map when the section is collapsed', async () => {
    const map = {
      addControl: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      resize: vi.fn(),
      remove: vi.fn(),
    }
    vi.mocked(mapboxgl.Map).mockImplementationOnce(
      () => map as unknown as mapboxgl.Map
    )
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'test-token')
    try {
      const user = userEvent.setup()
      render(
        <EditMatchCard matchId="match1" match={{ ...match, location: null }} />
      )

      const trigger = screen.getByRole('button', { name: 'Manage match' })
      await user.click(trigger)
      expect(screen.queryByText(/map unavailable/i)).not.toBeInTheDocument()
      expect(map.on).toHaveBeenCalledWith('click', expect.any(Function))

      await user.click(trigger)
      expect(map.off).toHaveBeenCalledWith('click', expect.any(Function))
      expect(map.remove).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
