import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationPicker } from './LocationPicker'
import { SavedLocationSelect } from './SavedLocationSelect'
import type { SavedLocation } from '@/types/savedLocation'

const mocks = vi.hoisted(() => ({
  getAllSavedLocations: vi.fn(),
  createSavedLocationAPI: vi.fn(),
}))

vi.mock('@/lib/services/savedLocationService', () => ({
  getAllSavedLocations: (...args: unknown[]) =>
    mocks.getAllSavedLocations(...args),
}))

vi.mock('@/lib/api/client', () => ({
  createSavedLocationAPI: (...args: unknown[]) =>
    mocks.createSavedLocationAPI(...args),
  updateSavedLocationAPI: vi.fn(),
  deleteSavedLocationAPI: vi.fn(),
}))

vi.mock('@/components/admin/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    locationName,
    address,
    onLocationNameChange,
    onAddressTextChange,
    nameId,
    addressId,
    disabled,
  }: {
    locationName: string
    address: string
    onLocationNameChange: (value: string) => void
    onAddressTextChange: (value: string) => void
    nameId?: string
    addressId?: string
    disabled?: boolean
  }) => (
    <div>
      <label htmlFor={nameId}>Location name</label>
      <input
        id={nameId}
        value={locationName}
        onChange={e => onLocationNameChange(e.target.value)}
        disabled={disabled}
      />
      <label htmlFor={addressId}>Address (optional)</label>
      <input
        id={addressId}
        value={address}
        onChange={e => onAddressTextChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  ),
}))

const existingLocation: SavedLocation = {
  id: 'loc_1',
  name: 'Field 4',
  address: '123 Main St',
  lat: 30.26,
  lng: -97.74,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

beforeAll(() => {
  Object.assign(HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

beforeEach(() => {
  mocks.getAllSavedLocations.mockReset()
  mocks.createSavedLocationAPI.mockReset()
  mocks.getAllSavedLocations.mockResolvedValue([existingLocation])
})

describe('SavedLocationSelect', () => {
  it('opens a create-location dialog from the picker', async () => {
    const user = userEvent.setup()
    render(<SavedLocationSelect onSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add location' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Add saved location' })
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Location name')).toBeInTheDocument()
  })

  it('creates a location, selects it, and adds it to the list', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    mocks.createSavedLocationAPI.mockResolvedValue({
      success: true,
      locationId: 'loc_new',
      location: {
        id: 'loc_new',
        name: 'South Field',
        address: '456 Oak Ave',
        lat: 33.8,
        lng: -85.7,
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    })

    render(<SavedLocationSelect onSelect={onSelect} />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })

    await user.click(screen.getByRole('button', { name: 'Add location' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(
      within(dialog).getByLabelText('Location name'),
      'South Field'
    )
    await user.type(
      within(dialog).getByLabelText('Address (optional)'),
      '456 Oak Ave'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Add location' })
    )

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'loc_new',
          name: 'South Field',
          address: '456 Oak Ave',
          lat: 33.8,
          lng: -85.7,
        })
      )
    })

    expect(mocks.createSavedLocationAPI).toHaveBeenCalledWith({
      name: 'South Field',
      address: '456 Oak Ave',
      lat: null,
      lng: null,
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('combobox'))
    expect(
      await screen.findByRole('option', { name: /South Field/ })
    ).toBeInTheDocument()
  })

  it('keeps the dialog open when creating a location fails', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    mocks.createSavedLocationAPI.mockRejectedValueOnce(new Error('Nope'))

    render(<SavedLocationSelect onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Add location' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByLabelText('Location name'),
      'South Field'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Add location' })
    )

    expect(await within(dialog).findByText('Nope')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('disables adding a location while the picker is disabled', () => {
    render(<SavedLocationSelect disabled onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Add location' })).toBeDisabled()
  })

  it('shows empty-state copy that points at the add action', async () => {
    mocks.getAllSavedLocations.mockResolvedValue([])
    render(<SavedLocationSelect onSelect={vi.fn()} />)

    expect(
      await screen.findByText(/no saved locations yet/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/add one to reuse it on future matches/i)
    ).toBeInTheDocument()
  })
})

function LocationPickerHarness() {
  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  return (
    <LocationPicker
      locationName={locationName}
      address={address}
      lat={lat}
      lng={lng}
      nameId="match-location-name"
      addressId="match-location-address"
      onLocationNameChange={setLocationName}
      onAddressTextChange={setAddress}
      onAddressSelect={loc => {
        setAddress(loc.address)
        setLat(loc.lat)
        setLng(loc.lng)
      }}
      onPinChange={coords => {
        setLat(coords?.lat ?? null)
        setLng(coords?.lng ?? null)
      }}
    />
  )
}

describe('LocationPicker', () => {
  it('applies a newly created saved location to the match fields', async () => {
    const user = userEvent.setup()
    mocks.createSavedLocationAPI.mockResolvedValue({
      success: true,
      locationId: 'loc_new',
      location: {
        id: 'loc_new',
        name: 'South Field',
        address: '456 Oak Ave',
        lat: 33.8,
        lng: -85.7,
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    })

    render(<LocationPickerHarness />)

    await user.click(screen.getByRole('button', { name: 'Add location' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByLabelText('Location name'),
      'South Field'
    )
    await user.type(
      within(dialog).getByLabelText('Address (optional)'),
      '456 Oak Ave'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Add location' })
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(screen.getByLabelText('Location name')).toHaveValue('South Field')
    expect(screen.getByLabelText('Address (optional)')).toHaveValue(
      '456 Oak Ave'
    )
  })
})
