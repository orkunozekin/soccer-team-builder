'use client'

import { useState } from 'react'
import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { recordAuditEventAPI } from '@/lib/api/client'
import {
  getAuthErrorMessage,
  hasPasswordProvider,
  requestEmailUpdate,
} from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const formLabelClass =
  'text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight'
const inputClass =
  'h-11 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500'

export function EmailUpdateForm() {
  const { user, userData } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!user || !hasPasswordProvider(user)) {
    return null
  }

  const currentEmail = userData?.email || user.email || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage(null)

    const trimmedEmail = newEmail.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (
      currentEmail &&
      trimmedEmail.toLowerCase() === currentEmail.toLowerCase()
    ) {
      setError('Enter a different email address.')
      return
    }

    if (!currentPassword) {
      setError('Current password is required.')
      return
    }

    setLoading(true)
    try {
      await requestEmailUpdate(user, currentPassword, trimmedEmail)
      recordAuditEventAPI({ action: 'auth.email_change_requested' })
      setSuccessMessage(
        'Check your new inbox for a confirmation link to finish updating your email.'
      )
      setNewEmail('')
      setCurrentPassword('')
    } catch (err: unknown) {
      setError(
        getAuthErrorMessage(err, 'Failed to update email. Please try again.')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="currentEmail" className={formLabelClass}>
          Current Email
        </Label>
        <Input
          id="currentEmail"
          type="email"
          value={currentEmail}
          disabled
          readOnly
          className={inputClass}
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newEmail" className={formLabelClass}>
          New Email
        </Label>
        <Input
          id="newEmail"
          type="email"
          placeholder="Enter your new email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="emailCurrentPassword" className={formLabelClass}>
          Current Password
        </Label>
        <PasswordInput
          id="emailCurrentPassword"
          placeholder="Confirm with your password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="current-password"
        />
      </div>

      <FormError message={error} />

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          loading={loading}
          className="h-11 w-full rounded-lg text-base font-semibold shadow-sm"
        >
          Update Email
        </Button>
      </div>
    </form>
  )
}
