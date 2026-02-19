'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { createRSVP, cancelRSVP, getUserRSVP } from '@/lib/services/rsvpService'
import { useMatchStore } from '@/store/matchStore'
import { Button } from '@/components/ui/button'
import { Match } from '@/types/match'

interface RSVPButtonProps {
  match: Match
}

export function RSVPButton({ match }: RSVPButtonProps) {
  const { user } = useAuth()
  const { matchRSVPs, addRSVP, removeRSVP } = useMatchStore()
  const [hasRSVPed, setHasRSVPed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && matchRSVPs.length > 0) {
      const userRSVP = matchRSVPs.find((r) => r.userId === user.uid)
      setHasRSVPed(!!userRSVP)
    } else {
      // Check if user has RSVPed
      const checkRSVP = async () => {
        if (user) {
          const rsvp = await getUserRSVP(match.id, user.uid)
          setHasRSVPed(!!rsvp)
        }
      }
      checkRSVP()
    }
  }, [user, match.id, matchRSVPs])

  const handleRSVP = async () => {
    if (!user) {
      setError('You must be logged in to RSVP')
      return
    }

    if (!match.rsvpOpen) {
      setError('RSVP is currently closed for this match')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (hasRSVPed) {
        // Cancel RSVP
        const rsvp = matchRSVPs.find((r) => r.userId === user.uid)
        if (rsvp) {
          await cancelRSVP(rsvp.id)
          removeRSVP(rsvp.id)
          setHasRSVPed(false)
        }
      } else {
        // Create RSVP
        const rsvpId = await createRSVP(match.id, user.uid)
        const newRSVP = {
          id: rsvpId,
          matchId: match.id,
          userId: user.uid,
          status: 'confirmed' as const,
          rsvpAt: new Date(),
          updatedAt: new Date(),
        }
        addRSVP(newRSVP)
        setHasRSVPed(true)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update RSVP')
    } finally {
      setLoading(false)
    }
  }

  if (!match.rsvpOpen) {
    return (
      <Button disabled className="w-full h-11 sm:h-9">
        RSVP Closed
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleRSVP}
        disabled={loading || !user}
        variant={hasRSVPed ? 'outline' : 'default'}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
      >
        {loading
          ? 'Processing...'
          : hasRSVPed
          ? 'Cancel RSVP'
          : 'RSVP to Match'}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
