'use client'

import { useEffect, useMemo, useState } from 'react'
import { LocationPicker } from '@/components/admin/LocationPicker'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { Card, CardDescription } from '@/components/ui/card'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { deleteMatchAPI, updateMatchAPI } from '@/lib/api/client'
import { hasValidCoords } from '@/lib/utils/geo'
import type { Match } from '@/types/match'

interface EditMatchCardProps {
  matchId: string
  match: Match
  onSaved?: () => void | Promise<void>
  onDeleted?: () => void
}

export function EditMatchCard({
  matchId,
  match,
  onSaved,
  onDeleted,
}: EditMatchCardProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const initialValues = useMemo(() => {
    const d = new Date(match.date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const loc = match.location
    return {
      date: `${y}-${m}-${day}`,
      time: match.time || '',
      locationName: (loc?.name || '').trim(),
      address: (loc?.address || '').trim(),
      lat: loc && hasValidCoords(loc) ? loc.lat : null,
      lng: loc && hasValidCoords(loc) ? loc.lng : null,
    }
  }, [match])

  useEffect(() => {
    setDate(initialValues.date)
    setTime(initialValues.time)
    setLocationName(initialValues.locationName)
    setAddress(initialValues.address)
    setLat(initialValues.lat)
    setLng(initialValues.lng)
  }, [initialValues])

  const hasChanges =
    date !== initialValues.date ||
    time !== initialValues.time ||
    locationName.trim() !== initialValues.locationName ||
    address.trim() !== initialValues.address ||
    lat !== initialValues.lat ||
    lng !== initialValues.lng

  const handleSaveDateTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time) return
    setSaving(true)
    setSaveSuccessMessage(null)
    try {
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)
      const name = locationName.trim()
      const addr = address.trim()
      const location =
        name || addr
          ? {
              name: name || addr,
              address: addr || name,
              lat: lat,
              lng: lng,
            }
          : null

      await updateMatchAPI(matchId, {
        date: matchDateTime.toISOString(),
        time,
        location,
      })
      const updated: string[] = []
      if (date !== initialValues.date) updated.push('Date')
      if (time !== initialValues.time) updated.push('Time')
      if (
        locationName.trim() !== initialValues.locationName ||
        address.trim() !== initialValues.address ||
        lat !== initialValues.lat ||
        lng !== initialValues.lng
      ) {
        updated.push('Location')
      }
      const message =
        updated.length > 0 ? `${updated.join(', ')} saved.` : 'Saved.'
      setSaveSuccessMessage(message)
      setTimeout(() => setSaveSuccessMessage(null), 3000)
      await onSaved?.()
    } catch {
      // Generic error; parent may show toast or rely on refetch
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteMatchAPI(matchId)
      setDeleteDialogOpen(false)
      onDeleted?.()
    } catch {
      alert('Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className="w-full max-w-xl">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="manage-match" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-base font-semibold">Manage match</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <CardDescription className="mb-4">
                Edit date, time, location, and RSVP window.
              </CardDescription>
              <div className="space-y-4">
                <form onSubmit={handleSaveDateTime} className="space-y-4">
                  <DatePickerTime
                    dateId="match-date"
                    timeId="match-time"
                    date={date}
                    time={time}
                    onDateChange={setDate}
                    onTimeChange={setTime}
                    datePlaceholder="Select date"
                    disabled={saving}
                    timeStep={300}
                  />
                  <LocationPicker
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
                    nameId="match-location-name"
                    addressId="match-location-address"
                  />
                  {saveSuccessMessage && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {saveSuccessMessage}
                    </p>
                  )}
                  <Button type="submit" loading={saving} disabled={!hasChanges}>
                    Save
                  </Button>
                </form>
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    loading={deleting}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete match
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the match from listings and close RSVPs. Match
              history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <ButtonSpinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RSVPPollControls match={match} onUpdated={onSaved} />
    </>
  )
}
