'use client'

import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuthStore } from '@/store/authStore'
import { getDocument } from '@/lib/firebase/firestore'
import { timestampToDate } from '@/lib/firebase/firestore'
import { User } from '@/types/user'

/** If auth/user fetch takes longer than this, stop showing loading so the app is still usable. */
const AUTH_LOADING_TIMEOUT_MS = 8_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserData, setLoading } = useAuthStore()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(true)

      const clearLoadingTimeout = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        setLoading(false)
      }, AUTH_LOADING_TIMEOUT_MS)

      try {
        if (firebaseUser) {
          try {
            const userDoc = await getDocument('users', firebaseUser.uid)
            if (userDoc) {
              const userData: User = {
                uid: userDoc.uid,
                email: userDoc.email,
                displayName: userDoc.displayName,
                jerseyNumber: userDoc.jerseyNumber ?? null,
                position: userDoc.position ?? null,
                role: userDoc.role || 'user',
                createdAt: timestampToDate(userDoc.createdAt) || new Date(),
                updatedAt: timestampToDate(userDoc.updatedAt) || new Date(),
              }
              setUserData(userData)
            } else {
              setUserData(null)
            }
          } catch (error) {
            console.error('Error fetching user data:', error)
            setUserData(null)
          }
        } else {
          setUserData(null)
        }
      } finally {
        clearLoadingTimeout()
        setLoading(false)
      }
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      unsubscribe()
    }
  }, [setUser, setUserData, setLoading])

  return <>{children}</>
}
