'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { updateUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/types/user'

export function ProfileForm() {
  const { user, userData } = useAuth()
  const setUserData = useAuthStore((state) => state.setUserData)
  const [displayName, setDisplayName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState<string>('')
  const [position, setPosition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName)
      setJerseyNumber(userData.jerseyNumber?.toString() || '')
      setPosition(userData.position)
    }
  }, [userData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!user || !userData) {
      setError('You must be logged in to update your profile')
      return
    }

    setLoading(true)

    try {
      const updates: Partial<Pick<User, 'displayName' | 'jerseyNumber' | 'position'>> = {
        displayName: displayName.trim(),
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
        position,
      }

      // Validate jersey number if provided
      if (jerseyNumber && (isNaN(parseInt(jerseyNumber, 10)) || parseInt(jerseyNumber, 10) < 0 || parseInt(jerseyNumber, 10) > 99)) {
        setError('Jersey number must be between 0 and 99')
        setLoading(false)
        return
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

  if (!userData) {
    return (
      <div className="text-center text-zinc-600 dark:text-zinc-400">
        Loading profile...
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          type="text"
          placeholder="Enter your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          disabled={loading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jerseyNumber">Jersey Number</Label>
        <Input
          id="jerseyNumber"
          type="number"
          min="0"
          max="99"
          placeholder="Enter jersey number (0-99)"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value)}
          disabled={loading}
          className="h-11 text-base sm:h-9 sm:text-sm"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Optional: Enter a number between 0 and 99
        </p>
      </div>

      <PositionSelector
        value={position}
        onValueChange={setPosition}
        disabled={loading}
      />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Profile updated successfully!
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
      >
        {loading ? 'Updating...' : 'Update Profile'}
      </Button>
    </form>
  )
}
