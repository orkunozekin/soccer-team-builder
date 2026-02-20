'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/hooks/useAuth'
import { updateUser } from '@/lib/services/userService'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { User } from '@/types/user'

interface ProfileCompleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function ProfileCompleteModal({ open, onOpenChange, onSaved }: ProfileCompleteModalProps) {
  const { user, userData } = useAuth()
  const setUserData = useAuthStore((state) => state.setUserData)
  const [displayName, setDisplayName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName ?? '')
      setJerseyNumber(userData.jerseyNumber?.toString() ?? '')
    }
  }, [userData, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return

    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('Display name is required')
      return
    }
    const num = jerseyNumber.trim() ? parseInt(jerseyNumber, 10) : NaN
    if (Number.isNaN(num) || num < 0 || num > 99) {
      setError('Jersey number must be 0–99')
      return
    }

    setLoading(true)
    try {
      const updates: Partial<Pick<User, 'displayName' | 'jerseyNumber'>> = {
        displayName: trimmedName,
        jerseyNumber: num,
      }
      await updateUser(user.uid, updates)
      const updatedUserData: User = {
        ...userData!,
        ...updates,
      }
      setUserData(updatedUserData)
      onOpenChange(false)
      onSaved?.()
    } catch (err: any) {
      setError(err.message ?? 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || !open) return null

  const modal = (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        aria-describedby="profile-modal-desc"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="mb-4 pr-8">
          <h2 id="profile-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Complete your profile
          </h2>
          <p id="profile-modal-desc" className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set your display name and jersey number to RSVP to matches.
          </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="modal-displayName">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="modal-displayName"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-jerseyNumber">
              Jersey Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="modal-jerseyNumber"
              type="number"
              min={0}
              max={99}
              placeholder="0–99"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              disabled={loading}
              className="h-11"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button type="submit" loading={loading} className="mt-2">
            Save and continue
          </Button>
        </form>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
