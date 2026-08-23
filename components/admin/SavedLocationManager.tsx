'use client'

import { useState } from 'react'
import { AddressAutocomplete } from '@/components/admin/AddressAutocomplete'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  createSavedLocationAPI,
  deleteSavedLocationAPI,
  updateSavedLocationAPI,
} from '@/lib/api/client'
import { hasValidCoords } from '@/lib/utils/geo'
import type { SavedLocation } from '@/types/savedLocation'

interface SavedLocationFormProps {
  initial?: SavedLocation | null
  onSaved?: () => void | Promise<void>
  onCancel?: () => void
}

export function SavedLocationForm({
  initial = null,
  onSaved,
  onCancel,
}: SavedLocationFormProps) {
  const [locationName, setLocationName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lat, setLat] = useState<number | null>(
    initial && hasValidCoords(initial) ? initial.lat : null
  )
  const [lng, setLng] = useState<number | null>(
    initial && hasValidCoords(initial) ? initial.lng : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const name = locationName.trim()
    const addr = address.trim()
    if (!name && !addr) {
      setError('Provide a location name or address')
      return
    }

    const payload = {
      name: name || addr,
      address: addr || name,
      lat,
      lng,
    }

    setSaving(true)
    try {
      if (initial) {
        await updateSavedLocationAPI(initial.id, payload)
      } else {
        await createSavedLocationAPI(payload)
        setLocationName('')
        setAddress('')
        setLat(null)
        setLng(null)
      }
      await onSaved?.()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save location'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AddressAutocomplete
        locationName={locationName}
        address={address}
        lat={lat}
        lng={lng}
        onLocationNameChange={setLocationName}
        onAddressTextChange={setAddress}
        onAddressSelect={loc => {
          setAddress(loc.address)
          setLat(loc.lat)
          setLng(loc.lng)
        }}
        onPinChange={coords => {
          if (!coords) {
            setLat(null)
            setLng(null)
            return
          }
          setLat(coords.lat)
          setLng(coords.lng)
        }}
        disabled={saving}
        nameId={initial ? `edit-location-name-${initial.id}` : 'new-location-name'}
        addressId={
          initial ? `edit-location-address-${initial.id}` : 'new-location-address'
        }
      />

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {initial ? 'Save changes' : 'Add location'}
        </Button>
      </div>
    </form>
  )
}

interface SavedLocationCardProps {
  location: SavedLocation
  onUpdated: () => void | Promise<void>
  onDeleted: () => void | Promise<void>
}

export function SavedLocationCard({
  location,
  onUpdated,
  onDeleted,
}: SavedLocationCardProps) {
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSavedLocationAPI(location.id)
      setDeleteOpen(false)
      await onDeleted()
    } catch {
      alert('Failed to delete location')
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edit location</CardTitle>
          <CardDescription>{location.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <SavedLocationForm
            initial={location}
            onSaved={async () => {
              setEditing(false)
              await onUpdated()
            }}
            onCancel={() => setEditing(false)}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{location.name}</CardTitle>
          {location.address && location.address !== location.name && (
            <CardDescription>{location.address}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-zinc-500">
            {hasValidCoords(location)
              ? `Pinned: ${location.lat!.toFixed(5)}, ${location.lng!.toFixed(5)}`
              : 'No map pin yet'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved location?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing matches keep their copied location data. This only removes
              the saved location from the picker list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <ButtonSpinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface CreateSavedLocationCardProps {
  onCreated?: () => void | Promise<void>
}

export function CreateSavedLocationCard({
  onCreated,
}: CreateSavedLocationCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Add saved location</CardTitle>
        <CardDescription>
          Store a venue once and reuse it when creating or editing matches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!expanded ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setExpanded(true)}
          >
            Add location
          </Button>
        ) : (
          <SavedLocationForm
            onSaved={async () => {
              setExpanded(false)
              await onCreated?.()
            }}
            onCancel={() => setExpanded(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
