import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import AdminLocationsPage from './page'
import { getAllSavedLocations } from '@/lib/services/savedLocationService'
import type { SavedLocation } from '@/types/savedLocation'

vi.mock('@/lib/services/savedLocationService', () => ({
  getAllSavedLocations: vi.fn(),
}))
vi.mock('@/components/admin/SavedLocationManager', () => ({
  CreateSavedLocationCard: () => null,
  SavedLocationCard: ({
    location,
    onUpdated,
  }: {
    location: SavedLocation
    onUpdated: () => Promise<void>
  }) => <button onClick={onUpdated}>{location.name}</button>,
}))

it('paginates locations and follows an edited location when its sort position changes', async () => {
  const locations = Array.from({ length: 11 }, (_, i) => ({
    id: `${i}`,
    name: `Venue ${i}`,
    address: '',
    lat: null,
    lng: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  vi.mocked(getAllSavedLocations).mockResolvedValueOnce(locations)
  const user = userEvent.setup()
  render(<AdminLocationsPage />)
  expect(await screen.findByText('Venue 0')).toBeInTheDocument()
  expect(screen.queryByText('Venue 10')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByText('Venue 10')).toBeInTheDocument()
  vi.mocked(getAllSavedLocations).mockResolvedValueOnce([
    { ...locations[10], name: 'A renamed venue' },
    ...locations.slice(0, 10),
  ])
  await user.click(screen.getByText('Venue 10'))
  expect(await screen.findByText('A renamed venue')).toBeInTheDocument()
  expect(screen.getByText('Showing 1–10 of 11 locations')).toBeInTheDocument()
})
