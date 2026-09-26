'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/auth/FormError'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { loginWithGoogle, registerUser, getAuthErrorMessage } from '@/lib/firebase/auth'
import { recordAuditEventAPI, redeemInviteAPI } from '@/lib/api/client'
import { createUser, getUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'

function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/matches'
  return raw
}

export type RegisterFormProps = {
  /** Invite code to redeem after account creation */
  inviteCode?: string | null
  /** Post-auth destination (e.g. /join?code=… or /matches) */
  redirectTo?: string | null
}

export function RegisterForm({
  inviteCode = null,
  redirectTo = null,
}: RegisterFormProps) {
  const router = useRouter()
  const setUser = useAuthStore(state => state.setUser)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState(inviteCode?.trim() ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const destination = safeRedirectPath(redirectTo)

  const finishAfterAuth = async () => {
    const trimmed = code.trim()
    if (trimmed) {
      await redeemInviteAPI(trimmed)
      // Prefer matches after a successful join; keep explicit non-join redirects.
      if (destination.startsWith('/join')) {
        router.push('/matches')
        return
      }
    }
    router.push(destination)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const userCredential = await registerUser(email, password)
      const user = userCredential.user

      // Create user document in Firestore (jersey number still needed for RSVP)
      await createUser(user.uid, email, displayName || email.split('@')[0])
      recordAuditEventAPI({ action: 'auth.register' })

      await finishAfterAuth()
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        'Failed to create account. Please try again.',
        'register'
      )
      setError(message)
      recordAuditEventAPI({
        action: 'auth.register_failed',
        metadata: { message },
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const userCredential = await loginWithGoogle()
      const user = userCredential.user
      const existingUser = await getUser(user.uid)
      if (!existingUser) {
        const displayName =
          user.displayName ?? user.email?.split('@')[0] ?? 'User'
        await createUser(user.uid, user.email ?? '', displayName)
        recordAuditEventAPI({ action: 'auth.register' })
      } else {
        recordAuditEventAPI({ action: 'auth.login' })
      }
      setUser(user)
      await finishAfterAuth()
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        'Failed to sign in with Google. Please try again.',
        'google'
      )
      setError(message)
      recordAuditEventAPI({
        action: 'auth.register_failed',
        metadata: { message, provider: 'google' },
      })
    } finally {
      setGoogleLoading(false)
    }
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
          onChange={e => setDisplayName(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          placeholder="Enter your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <PasswordInput
          id="confirmPassword"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="inviteCode">Club invite code (optional)</Label>
        <Input
          id="inviteCode"
          type="text"
          placeholder="Enter invite code"
          value={code}
          onChange={e => setCode(e.target.value)}
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="off"
        />
      </div>

      <FormError message={error} />

      <Button
        type="submit"
        disabled={googleLoading}
        loading={loading}
        className="h-11 w-full text-base sm:h-9 sm:text-sm"
      >
        Create Account
      </Button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
          Or continue with
        </span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={loading}
        loading={googleLoading}
        className="h-11 w-full text-base sm:h-9 sm:text-sm"
        onClick={handleGoogleSignIn}
      >
        <span className="inline-flex items-center justify-center">
          <GoogleIcon className="mr-2" />
          Sign up with Google
        </span>
      </Button>
    </form>
  )
}
