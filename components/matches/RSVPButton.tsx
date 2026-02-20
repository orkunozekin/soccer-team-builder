'use client'

import { useEffect, useState } from 'react'
import { ProfileCompleteModal } from '@/components/profile/ProfileCompleteModal'
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { cancelRSVPAPI, confirmRSVPAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserRSVP } from '@/lib/services/rsvpService'
import { isProfileComplete } from '@/lib/utils/profile'
import { useMatchStore } from '@/store/matchStore'
import { Match } from '@/types/match'

interface RSVPButtonProps {
  match: Match
  onTeamsRegenerated?: () => void | Promise<void>
}

export function RSVPButton({ match, onTeamsRegenerated }: RSVPButtonProps) {
  const { user, userData } = useAuth()
  const profileComplete = isProfileComplete(userData)
  const { matchRSVPs, addRSVP, removeRSVP } = useMatchStore()
  const [hasRSVPed, setHasRSVPed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false)

  useEffect(() => {
    if (user && matchRSVPs.length > 0) {
      const userRSVP = matchRSVPs.find((r) => r.userId === user.uid)
      setHasRSVPed(!!userRSVP)
    } else {
      const checkRSVP = async () => {
        if (user) {
          const rsvp = await getUserRSVP(match.id, user.uid)
          setHasRSVPed(!!rsvp)
        }
      }
      checkRSVP()
    }
  }, [user, match.id, matchRSVPs])

  const submitConfirmRSVP = async () => {
    if (!user || !match.rsvpOpen) return
    setLoading(true)
    setError('')
    try {
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
    } catch (err: any) {
      setError(err.message || 'Failed to update RSVP')
    } finally {
      setLoading(false)
    }
  }

  const handleRSVP = async () => {
    if (!user) {
      setError('You must be logged in to RSVP')
      return
    }

    if (!profileComplete) {
      setProfileDrawerOpen(true)
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
        await submitConfirmRSVP()
      }
    } catch {
      setError('Failed to update RSVP')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSaved = () => {
    submitConfirmRSVP()
  }

  if (!match.rsvpOpen) {
    return null
  }

  return (
    <div className="space-y-2">
      <ProfileCompleteModal
        open={profileDrawerOpen}
        onOpenChange={setProfileDrawerOpen}
        onSaved={handleProfileSaved}
      />
      <Button
        onClick={handleRSVP}
        disabled={!user}
        loading={loading}
        variant={hasRSVPed ? 'outline' : 'default'}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
      >
        {hasRSVPed ? 'Cancel RSVP' : 'RSVP to Match'}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
