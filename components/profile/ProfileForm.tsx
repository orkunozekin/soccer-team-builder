'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { updateUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/types/user'

export function ProfileForm() {
  const { user, userData } = useAuth()

  if (!userData) {
    return (
      <div className="text-center text-zinc-600 dark:text-zinc-400">
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
  const setUserData = useAuthStore((state) => state.setUserData)
  const [displayName, setDisplayName] = useState(userData.displayName)
  const [jerseyNumber, setJerseyNumber] = useState<string>(
    userData.jerseyNumber?.toString() || ''
  )
  const [position, setPosition] = useState<string | null>(userData.position ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Sync form when userData changes (e.g. after refetch or another tab)
  useEffect(() => {
    setDisplayName(userData.displayName)
    setJerseyNumber(userData.jerseyNumber?.toString() || '')
    setPosition(userData.position ?? null)
  }, [userData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

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
      const num = jerseyNumber ? parseInt(jerseyNumber, 10) : null
      if (num === null || isNaN(num) || num < 0 || num > 99) {
        setError('Jersey number is required and must be 0–99')
        setLoading(false)
        return
      }

      const updates: Partial<Pick<User, 'displayName' | 'jerseyNumber' | 'position'>> = {
        displayName: trimmedName,
        jerseyNumber: num,
        position,
      }

      await updateUser(user.uid, updates)

      // Update local state
      const updatedUserData: User = {
        ...userData,
        ...updates,
      }
      setUserData(updatedUserData)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const formLabelClass =
    'text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight'
  const inputClass =
    'h-11 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500'

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
          onChange={(e) => setDisplayName(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="jerseyNumber" className={formLabelClass}>
          Jersey Number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="jerseyNumber"
          type="number"
          min="0"
          max="99"
          placeholder="0–99"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Required to RSVP · 0 to 99
        </p>
      </div>

      <PositionSelector
        value={position}
        onValueChange={setPosition}
        disabled={loading}
        labelClassName={formLabelClass}
        triggerClassName={inputClass}
      />

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Profile updated successfully
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          loading={loading}
          className="w-full h-11 rounded-lg text-base font-semibold shadow-sm"
        >
          Update Profile
        </Button>
      </div>
    </form>
  )
}
