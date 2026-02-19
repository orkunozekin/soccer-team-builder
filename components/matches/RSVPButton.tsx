'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cancelRSVPAPI, confirmRSVPAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserRSVP } from '@/lib/services/rsvpService'
import { useMatchStore } from '@/store/matchStore'
import { Match } from '@/types/match'

interface RSVPButtonProps {
  match: Match
  onTeamsRegenerated?: () => void | Promise<void>
}

export function RSVPButton({ match, onTeamsRegenerated }: RSVPButtonProps) {
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
        // Cancel RSVP (API updates RSVP and removes user from team / deletes empty team)
        const rsvp = matchRSVPs.find((r) => r.userId === user.uid)
        if (rsvp) {
          const { teamsUpdated } = await cancelRSVPAPI(rsvp.id)
          removeRSVP(rsvp.id)
          setHasRSVPed(false)
          if (teamsUpdated && onTeamsRegenerated) {
            await onTeamsRegenerated()
          }
        }
      } else {
        // Confirm RSVP via API (creates RSVP and expands teams when 23+ RSVPs)
        const { rsvpId, regenerated } = await confirmRSVPAPI(match.id)
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
        if (regenerated && onTeamsRegenerated) {
          await onTeamsRegenerated()
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update RSVP')
    } finally {
      setLoading(false)
    }
  }

  if (!match.rsvpOpen) {
    return null
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
