'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormError } from '@/components/auth/FormError'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginWithGoogle, registerUser } from '@/lib/firebase/auth'
import { createUser, getUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'

export function RegisterForm() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

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

      router.push('/matches')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
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
      }
      setUser(user)
      router.push('/matches')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
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
          onChange={(e) => setDisplayName(e.target.value)}
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
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading || googleLoading}
          className="h-11 text-base sm:h-9 sm:text-sm"
          autoComplete="new-password"
        />
      </div>

      <FormError message={error} />

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
      >
        {loading ? 'Creating account...' : 'Create Account'}
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
        disabled={loading || googleLoading}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
        onClick={handleGoogleSignIn}
      >
        {googleLoading ? (
          'Signing in...'
        ) : (
          <span className="inline-flex items-center justify-center">
            <GoogleIcon className="mr-2" />
            Sign up with Google
          </span>
        )}
      </Button>
    </form>
  )
}
