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

const formLabelClass = 'text-base font-semibold text-foreground tracking-tight'
const inputClass =
  'h-11 rounded-lg text-sm text-foreground placeholder:text-muted-foreground border-input bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'

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
        <div className="rounded-lg border border-success-line/50 bg-success-deep/30 px-4 py-3 text-sm font-medium text-success-soft">
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
