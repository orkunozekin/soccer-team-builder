'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FormError } from '@/components/auth/FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/lib/firebase/auth'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not send a reset email. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          If an account exists for that email, we sent a link to reset
          your password. Check your inbox and spam folder.
        </p>
        <Button asChild className="h-11 w-full text-base sm:h-9 sm:text-sm">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={loading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="email"
        />
      </div>

      <FormError message={error} />

      <Button
        type="submit"
        disabled={loading}
        loading={loading}
        className="h-11 w-full text-base sm:h-9 sm:text-sm"
      >
        Send reset link
      </Button>
    </form>
  )
}
