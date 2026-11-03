'use client'

import { useState } from 'react'
import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { recordAuditEventAPI } from '@/lib/api/client'
import {
  getAuthErrorMessage,
  hasPasswordProvider,
  updateUserPassword,
} from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'

const formLabelClass = 'text-base font-semibold text-foreground tracking-tight'
const inputClass =
  'h-11 rounded-lg text-sm text-foreground placeholder:text-muted-foreground border-input bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring'

export function PasswordUpdateForm() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!user || !hasPasswordProvider(user)) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setLoading(true)
    try {
      await updateUserPassword(user, currentPassword, newPassword)
      recordAuditEventAPI({ action: 'auth.password_changed' })
      setSuccessMessage('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: unknown) {
      setError(
        getAuthErrorMessage(err, 'Failed to update password. Please try again.')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword" className={formLabelClass}>
          Current Password
        </Label>
        <PasswordInput
          id="currentPassword"
          placeholder="Enter your current password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className={formLabelClass}>
          New Password
        </Label>
        <PasswordInput
          id="newPassword"
          placeholder="Enter a new password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmNewPassword" className={formLabelClass}>
          Confirm New Password
        </Label>
        <PasswordInput
          id="confirmNewPassword"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          autoComplete="new-password"
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
          Update Password
        </Button>
      </div>
    </form>
  )
}
