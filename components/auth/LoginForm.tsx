'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginUser, loginWithGoogle } from '@/lib/firebase/auth'
import { getUser, createUser } from '@/lib/services/userService'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
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
      router.push('/matches')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
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
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="relative my-4">
        <span className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200 dark:border-gray-700" />
        </span>
        <span className="relative flex justify-center text-xs uppercase text-gray-500 dark:text-gray-400">
          Or continue with
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={loading || googleLoading}
        className="w-full h-11 text-base sm:h-9 sm:text-sm"
        onClick={handleGoogleSignIn}
      >
        {googleLoading ? 'Signing in...' : 'Sign in with Google'}
      </Button>
    </form>
  )
}
