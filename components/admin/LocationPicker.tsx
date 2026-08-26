'use client'

import { useState } from 'react'
import { AddressAutocomplete } from '@/components/admin/AddressAutocomplete'
import { SavedLocationSelect } from '@/components/admin/SavedLocationSelect'
import type { SavedLocation } from '@/types/savedLocation'

interface LocationPickerProps {
  locationName: string
  address: string
  lat: number | null
  lng: number | null
  selectedSavedLocationId?: string | null
  onLocationNameChange: (name: string) => void
  onAddressSelect: (loc: {
    address: string
    lat: number | null
    lng: number | null
    name?: string
  }) => void
  onAddressTextChange: (address: string) => void
  onPinChange: (coords: { lat: number; lng: number } | null) => void
  onSavedLocationChange?: (locationId: string | null) => void
  disabled?: boolean
  nameId?: string
  addressId?: string
}

function applySavedLocation(
  location: SavedLocation,
  handlers: Pick<
    LocationPickerProps,
    | 'onLocationNameChange'
    | 'onAddressTextChange'
    | 'onPinChange'
    | 'onSavedLocationChange'
  >
) {
  handlers.onSavedLocationChange?.(location.id)
  handlers.onLocationNameChange(location.name)
  handlers.onAddressTextChange(location.address)
  if (location.lat != null && location.lng != null) {
    handlers.onPinChange({ lat: location.lat, lng: location.lng })
  } else {
    handlers.onPinChange(null)
  }
}

export function LocationPicker({
  locationName,
  address,
  lat,
  lng,
  selectedSavedLocationId,
  onLocationNameChange,
  onAddressSelect,
  onAddressTextChange,
  onPinChange,
  onSavedLocationChange,
  disabled,
  nameId,
  addressId,
}: LocationPickerProps) {
  const [savedLocationId, setSavedLocationId] = useState<string | null>(
    selectedSavedLocationId ?? null
  )

  const handleManualChange = () => {
    if (savedLocationId) {
      setSavedLocationId(null)
      onSavedLocationChange?.(null)
    }
  }

  return (
    <div className="space-y-4">
      <SavedLocationSelect
        disabled={disabled}
        selectedId={savedLocationId}
        onSelect={location => {
          if (!location) {
            setSavedLocationId(null)
            onSavedLocationChange?.(null)
            return
          }
          applySavedLocation(location, {
            onLocationNameChange,
            onAddressTextChange,
            onPinChange,
            onSavedLocationChange: id => {
              setSavedLocationId(id)
              onSavedLocationChange?.(id)
            },
          })
        }}
      />

      <AddressAutocomplete
        locationName={locationName}
        address={address}
        lat={lat}
        lng={lng}
        onLocationNameChange={value => {
          handleManualChange()
          onLocationNameChange(value)
        }}
        onAddressTextChange={value => {
          handleManualChange()
          onAddressTextChange(value)
        }}
        onAddressSelect={loc => {
          handleManualChange()
          onAddressSelect(loc)
        }}
        onPinChange={coords => {
          handleManualChange()
          onPinChange(coords)
        }}
        disabled={disabled}
        nameId={nameId}
        addressId={addressId}
      />
    </div>
  )
}
