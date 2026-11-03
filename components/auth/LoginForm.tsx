'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/auth/FormError'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { recordAuditEventAPI } from '@/lib/api/client'
import {
  getAuthErrorMessage,
  loginUser,
  loginWithGoogle,
} from '@/lib/firebase/auth'
import { createUser, getUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'

export function LoginForm({
  redirectTo = '/matches',
}: {
  redirectTo?: string
}) {
  const router = useRouter()
  const setUser = useAuthStore(state => state.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await loginUser(email, password)
      setUser(userCredential.user)
      recordAuditEventAPI({ action: 'auth.login' })
      router.push(redirectTo)
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        'Failed to sign in. Please try again.',
        'login'
      )
      setError(message)
      recordAuditEventAPI({
        action: 'auth.login_failed',
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
      router.push(redirectTo)
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        err,
        'Failed to sign in with Google. Please try again.',
        'google'
      )
      setError(message)
      recordAuditEventAPI({
        action: 'auth.login_failed',
        metadata: { message, provider: 'google' },
      })
    } finally {
      setGoogleLoading(false)
    }
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
          disabled={loading || googleLoading}
          className="h-12 text-base"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#B9C2BD] underline-offset-4 hover:text-chalk hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          placeholder="Enter your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-12 text-base"
          autoComplete="current-password"
        />
      </div>

      <FormError message={error} />

      <Button
        type="submit"
        disabled={loading || googleLoading}
        loading={loading}
        size="hero"
        className="w-full"
      >
        Sign in
      </Button>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fog">
          Or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={loading}
        loading={googleLoading}
        className="h-12 w-full rounded-2xl text-base"
        onClick={handleGoogleSignIn}
      >
        <span className="inline-flex items-center justify-center">
          <GoogleIcon className="mr-2" />
          Continue with Google
        </span>
      </Button>
    </form>
  )
}
