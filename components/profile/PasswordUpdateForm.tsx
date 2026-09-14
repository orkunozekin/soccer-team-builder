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

const formLabelClass =
  'text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight'
const inputClass =
  'h-11 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500'

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
        getAuthErrorMessage(
          err,
          'Failed to update password. Please try again.'
        )
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
          Update Password
        </Button>
      </div>
    </form>
  )
}
