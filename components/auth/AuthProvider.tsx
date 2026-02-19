'use client'

import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuthStore } from '@/store/authStore'
import { getDocument } from '@/lib/firebase/firestore'
import { timestampToDate } from '@/lib/firebase/firestore'
import { User } from '@/types/user'
import { createUser } from '@/lib/services/userService'

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
            let userDoc = await getDocument('users', firebaseUser.uid)

            // Some legacy accounts may exist in Auth but not in Firestore yet.
            // Ensure the canonical user doc exists at /users/{uid} so role-based UI works.
            if (!userDoc) {
              const displayName =
                firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User'
              await createUser(firebaseUser.uid, firebaseUser.email ?? '', displayName)
              userDoc = await getDocument('users', firebaseUser.uid)
            }

            if (userDoc) {
              const roleRaw = typeof userDoc.role === 'string' ? userDoc.role.trim() : ''
              const role: User['role'] = roleRaw === 'admin' ? 'admin' : 'user'

              const userData: User = {
                uid: firebaseUser.uid,
                email: (userDoc.email as string) ?? firebaseUser.email ?? '',
                displayName: (userDoc.displayName as string) ?? firebaseUser.displayName ?? '',
                jerseyNumber: userDoc.jerseyNumber ?? null,
                position: userDoc.position ?? null,
                role,
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
