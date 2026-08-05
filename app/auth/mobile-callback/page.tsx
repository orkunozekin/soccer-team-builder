'use client'

import { useEffect, useState } from 'react'

/**
 * OAuth redirect target for the Soccerville native app.
 * Google redirects here with ?code=...&state=...; we forward to the
 * Expo return URL embedded in `state` so openAuthSessionAsync can complete.
 */
export default function MobileAuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const code = params.get('code')
    const state = params.get('state')

    if (!state) {
      setMessage('Sign-in failed: missing state. You can close this window.')
      return
    }

    const separator = state.indexOf('.')
    if (separator <= 0) {
      setMessage('Sign-in failed: invalid state. You can close this window.')
      return
    }

    let returnUrl: string
    try {
      returnUrl = decodeURIComponent(state.slice(separator + 1))
    } catch {
      setMessage('Sign-in failed: invalid return URL. You can close this window.')
      return
    }

    if (!returnUrl.startsWith('exp://') && !returnUrl.startsWith('soccerville://')) {
      setMessage('Sign-in failed: unexpected return URL. You can close this window.')
      return
    }

    const target = new URL(returnUrl)
    if (error) {
      target.searchParams.set('error', error)
      const description = params.get('error_description')
      if (description) {
        target.searchParams.set('error_description', description)
      }
    }
    if (code) {
      target.searchParams.set('code', code)
    }
    // Forward the full state so the app can verify CSRF.
    target.searchParams.set('state', state)

    window.location.replace(target.toString())
  }, [])

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
    </main>
  )
}
