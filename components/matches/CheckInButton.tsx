'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkInAPI } from '@/lib/api/client'
import {
  getCheckInWindow,
  isWithinCheckInWindow,
  venueHasCheckInCoords,
} from '@/lib/utils/checkIn'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

interface CheckInButtonProps {
  match: Match
  userRsvp: RSVP | null
  onCheckedIn?: () => void | Promise<void>
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    })
  })
}

export function CheckInButton({
  match,
  userRsvp,
  onCheckedIn,
}: CheckInButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const inWindow = isWithinCheckInWindow(match.date, match.time)
  const confirmed = userRsvp?.status === 'confirmed'
  const alreadyPresent = userRsvp?.attended === true
  const hasVenue = venueHasCheckInCoords(match.location)
  const windowTimes = getCheckInWindow(match.date, match.time)

  if (!confirmed) return null
  if (!inWindow && !alreadyPresent) return null

  const handleCheckIn = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const pos = await getCurrentPosition()
      await checkInAPI(match.id, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
      setSuccess(true)
      await onCheckedIn?.()
    } catch (err: unknown) {
      const geoErr = err as { code?: number; message?: string }
      if (geoErr?.code === 1) {
        setError(
          'Location permission denied. Enable location or ask a host to mark you present.'
        )
      } else if (geoErr?.code === 2 || geoErr?.code === 3) {
        setError(
          'Could not get an accurate location. Try again outdoors or ask a host.'
        )
      } else {
        setError(
          geoErr?.message || 'Check-in failed. Ask a host to mark you present.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-red-50" />
        <p className="text-sm font-semibold text-foreground">Field check-in</p>
      </div>

      {alreadyPresent || success ? (
        <p className="text-sm text-success">
          You&apos;re checked in
          {userRsvp?.checkInMethod === 'host' ? ' (by host)' : ''}.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Available {format(windowTimes.start, 'h:mm a')} –{' '}
            {format(windowTimes.end, 'h:mm a')}. Your location is used once to
            verify you&apos;re at the field and is not stored.
          </p>
          {!hasVenue && (
            <p className="text-xs text-warning">
              This match has no pinned field coordinates. Ask a host to mark you
              present.
            </p>
          )}
          <Button
            type="button"
            onClick={handleCheckIn}
            loading={loading}
            disabled={!hasVenue || loading}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            Check in at the field
          </Button>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
