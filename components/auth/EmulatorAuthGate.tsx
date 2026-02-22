'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth, connectToEmulators } from '@/lib/firebase/config'

// Use env only (no window) so server and client get the same initial state and avoid hydration mismatch.
const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'

/**
 * When using the Auth emulator, we must clear any persisted (production) session
 * before rendering auth-dependent UI. Otherwise the client sends a production JWT
 * to the Firestore emulator, which rejects it and the user doc is never created.
 * This gate waits for signOut to complete before rendering children.
 */
export function EmulatorAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!USE_EMULATOR)

  useEffect(() => {
    if (!USE_EMULATOR) {
      setReady(true)
      return
    }
    // Connect to emulators here (client-only) so we never use the SSR instance that wasn't connected.
    connectToEmulators()
    let cancelled = false
    signOut(auth)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Preparing local emulator…
      </div>
    )
  }

  return <>{children}</>
}
