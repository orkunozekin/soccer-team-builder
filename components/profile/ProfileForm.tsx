'use client'

import { useEffect, useMemo, useState } from 'react'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/hooks/useAuth'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import { User } from '@/types/user'

export function ProfileForm() {
  const { user, userData } = useAuth()

  if (!userData) {
    return (
      <div className="text-center text-muted-foreground">
        Loading profile...
      </div>
    )
  }

  return <ProfileFormInner user={user!} userData={userData} />
}

function ProfileFormInner({
  user,
  userData,
}: {
  user: import('firebase/auth').User
  userData: User
}) {
  const setUserData = useAuthStore(state => state.setUserData)
  const [displayName, setDisplayName] = useState(userData.displayName)
  const [jerseyNumber, setJerseyNumber] = useState<string>(
    userData.jerseyNumber?.toString() || ''
  )
  const [position, setPosition] = useState<string | null>(
    userData.position ?? null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const savedDisplayName = userData.displayName
  const savedJerseyNumber = userData.jerseyNumber
  const savedPosition = userData.position ?? null

  const initialValues = useMemo(
    () => ({
      displayName: savedDisplayName,
      jerseyNumber: savedJerseyNumber?.toString() ?? '',
      position: savedPosition,
    }),
    [savedDisplayName, savedJerseyNumber, savedPosition]
  )

  // Sync the form when these saved fields change (e.g. after refetch or
  // another tab). Keyed on the fields, not the whole profile object, so an
  // unrelated profile update (the sidebar theme toggle) keeps unsaved edits.
  useEffect(() => {
    setDisplayName(savedDisplayName)
    setJerseyNumber(savedJerseyNumber?.toString() || '')
    setPosition(savedPosition)
  }, [savedDisplayName, savedJerseyNumber, savedPosition])

  const currentJerseyNormalized = jerseyNumber.trim()
    ? (() => {
        const parsed = parseInt(jerseyNumber, 10)
        return Number.isNaN(parsed) || parsed < 0 || parsed > 99 ? null : parsed
      })()
    : null
  const initialJerseyNormalized = initialValues.jerseyNumber.trim()
    ? (() => {
        const parsed = parseInt(initialValues.jerseyNumber, 10)
        return Number.isNaN(parsed) || parsed < 0 || parsed > 99 ? null : parsed
      })()
    : null

  const hasChanges =
    displayName.trim() !== initialValues.displayName ||
    currentJerseyNormalized !== initialJerseyNormalized ||
    position !== initialValues.position

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage(null)

    if (!user) {
      setError('You must be logged in to update your profile')
      return
    }

    setLoading(true)

    try {
      const trimmedName = displayName.trim()
      if (!trimmedName) {
        setError('Display name is required')
        setLoading(false)
        return
      }
      const parsed = jerseyNumber.trim() ? parseInt(jerseyNumber, 10) : NaN
      const jersey =
        Number.isNaN(parsed) || parsed < 0 || parsed > 99 ? null : parsed

      const updates: Partial<
        Pick<User, 'displayName' | 'jerseyNumber' | 'position'>
      > = {
        displayName: trimmedName,
        jerseyNumber: jersey,
        position,
      }

      await updateProfileAPI(updates)

      // Update local state
      const updatedUserData: User = {
        ...userData,
        ...updates,
      }
      setUserData(updatedUserData)

      const updated: string[] = []
      if (trimmedName !== initialValues.displayName)
        updated.push('Display name')
      if (jersey !== initialJerseyNormalized) updated.push('Jersey number')
      if (position !== initialValues.position) updated.push('Position')
      const message =
        updated.length > 0 ? `${updated.join(', ')} saved.` : 'Saved.'
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      setError('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const formLabelClass =
    'text-base font-semibold text-foreground tracking-tight'
  const inputClass =
    'h-11 rounded-lg text-sm text-foreground placeholder:text-muted-foreground border-input bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="displayName" className={formLabelClass}>
          Display Name
        </Label>
        <Input
          id="displayName"
          type="text"
          placeholder="Enter your name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="jerseyNumber" className={formLabelClass}>
          Jersey Number
        </Label>
        <Input
          id="jerseyNumber"
          type="number"
          min="0"
          max="99"
          placeholder="0–99"
          value={jerseyNumber}
          onChange={e => setJerseyNumber(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">Optional · 0 to 99</p>
      </div>

      <PositionSelector
        value={position}
        onValueChange={setPosition}
        disabled={loading}
        labelClassName={formLabelClass}
        triggerClassName={inputClass}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {successMessage && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          loading={loading}
          disabled={!hasChanges}
          className="h-11 w-full rounded-lg text-base font-semibold shadow-sm"
        >
          Update Profile
        </Button>
      </div>
    </form>
  )
}
