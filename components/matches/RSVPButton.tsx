'use client'

import { useEffect, useState } from 'react'
import { ProfileCompleteModal } from '@/components/profile/ProfileCompleteModal'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { cancelRSVPAPI, confirmRSVPAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { getUserRSVP } from '@/lib/services/rsvpService'
import { isProfileComplete } from '@/lib/utils/profile'
import { useMatchStore } from '@/store/matchStore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Match } from '@/types/match'

interface RSVPButtonProps {
  match: Match
  onTeamsRegenerated?: () => void | Promise<void>
  /** Call when backend says RSVP is closed so the parent can refetch the match and update UI */
  onMatchRefetch?: () => void | Promise<void>
}

export function RSVPButton({ match, onTeamsRegenerated, onMatchRefetch }: RSVPButtonProps) {
  const { user, userData } = useAuth()
  const profileComplete = isProfileComplete(userData)
  const { matchRSVPs, addRSVP, removeRSVP } = useMatchStore()
  const [hasRSVPed, setHasRSVPed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false)
  const [showPositionPickerForGkBlock, setShowPositionPickerForGkBlock] = useState(false)
  const [positionForRsvp, setPositionForRsvp] = useState<string | null>(null)

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

  const submitConfirmRSVP = async (positionOverride?: string | null) => {
    if (!user || !match.rsvpOpen) return
    setLoading(true)
    setError('')
    setShowPositionPickerForGkBlock(false)
    try {
      const { rsvpId, regenerated, position } = await confirmRSVPAPI(
        match.id,
        positionOverride
      )
      const newRSVP = {
        id: rsvpId,
        matchId: match.id,
        userId: user.uid,
        status: 'confirmed' as const,
        position: position ?? null,
        rsvpAt: new Date(),
        updatedAt: new Date(),
      }
      addRSVP(newRSVP)
      setHasRSVPed(true)
      setPositionForRsvp(null)
      if (regenerated && onTeamsRegenerated) {
        await onTeamsRegenerated()
      }
    } catch (err: any) {
      const message = err.message || 'Failed to update RSVP'
      setError(message)
      if (message.includes('RSVP is closed') && onMatchRefetch) {
        await onMatchRefetch()
      }
      if (message.includes('2 goalkeepers')) {
        setShowPositionPickerForGkBlock(true)
        setPositionForRsvp(null)
      }
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

    if (hasRSVPed) {
      setLoading(true)
      setError('')
      try {
        const rsvp = matchRSVPs.find((r) => r.userId === user.uid)
        if (rsvp) {
          const { teamsUpdated } = await cancelRSVPAPI(rsvp.id)
          removeRSVP(rsvp.id)
          setHasRSVPed(false)
          if (teamsUpdated && onTeamsRegenerated) {
            await onTeamsRegenerated()
          }
        }
      } catch {
        setError('Failed to update RSVP')
      } finally {
        setLoading(false)
      }
      return
    }

    await submitConfirmRSVP()
  }

  const handleProfileSaved = () => {
    submitConfirmRSVP()
  }

  const handleRsvpWithPosition = () => {
    if (positionForRsvp && !isGoalkeeper(positionForRsvp)) {
      submitConfirmRSVP(positionForRsvp)
    }
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
      {showPositionPickerForGkBlock && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3 space-y-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            There are already 2 goalkeepers for this match. Choose a different position to RSVP.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem]">
              <PositionSelector
                value={positionForRsvp}
                onValueChange={setPositionForRsvp}
                disabled={loading}
                hideLabel
              />
            </div>
            <Button
              size="sm"
              onClick={handleRsvpWithPosition}
              loading={loading}
              disabled={!positionForRsvp || isGoalkeeper(positionForRsvp)}
            >
              RSVP with this position
            </Button>
          </div>
          {positionForRsvp && isGoalkeeper(positionForRsvp) && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Please select a non-goalkeeper position.
            </p>
          )}
        </div>
      )}
      {!showPositionPickerForGkBlock && (
        <Button
          onClick={handleRSVP}
          disabled={!user}
          loading={loading}
          variant={hasRSVPed ? 'outline' : 'default'}
          className="w-full h-11 text-base sm:h-9 sm:text-sm"
        >
          {hasRSVPed ? 'Cancel RSVP' : 'RSVP to Match'}
        </Button>
      )}
      {error && !showPositionPickerForGkBlock && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
