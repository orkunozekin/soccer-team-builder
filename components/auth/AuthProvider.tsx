'use client'

import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useAuthStore } from '@/store/authStore'
import { getDocument } from '@/lib/firebase/firestore'
import { timestampToDate } from '@/lib/firebase/firestore'
import { User } from '@/types/user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserData, setLoading } = useAuthStore()

  useEffect(() => {
    // Initialize Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(true)

      if (firebaseUser) {
        // Fetch user data from Firestore
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

      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setUserData, setLoading])

  return <>{children}</>
}
