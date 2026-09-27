'use client'

import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { recordAuditEventAPI, updateProfileAPI } from '@/lib/api/client'
import { auth } from '@/lib/firebase/config'
import { getDocument } from '@/lib/firebase/firestore'
import { timestampToDate } from '@/lib/firebase/firestore'
import { createUser } from '@/lib/services/userService'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'
import { resolveHydratedActiveClubId } from '@/lib/utils/resolveHydratedActiveClubId'
import { useAuthStore } from '@/store/authStore'
import { User, normalizeUserRole } from '@/types/user'

/** If auth/user fetch takes longer than this, stop showing loading so the app is still usable. */
const AUTH_LOADING_TIMEOUT_MS = 8_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserData, setLoading, setProfileReady } = useAuthStore()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      const nextUid = firebaseUser?.uid ?? null
      const prevUid = useAuthStore.getState().user?.uid ?? null
      // Token refresh reuses the same uid. A new sign-in must not inherit
      // profileReady from the previous signed-out (or other-user) callback.
      const identityChanged = nextUid !== prevUid

      setUser(firebaseUser)
      if (identityChanged) {
        setUserData(null)
        setProfileReady(false)
      }

      // Auth store starts with loading: true. Do not flip loading back to true
      // on later auth callbacks (token refresh, user doc re-fetch, etc.). That
      // remounts LaunchDarkly + page trees and can leave match detail stuck on
      // its skeleton during client-side navigations.
      const clearLoadingTimeout = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      if (useAuthStore.getState().loading && timeoutRef.current == null) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          setLoading(false)
        }, AUTH_LOADING_TIMEOUT_MS)
      }

      try {
        if (firebaseUser) {
          try {
            let userDoc = await getDocument('users', firebaseUser.uid)

            // Some legacy accounts may exist in Auth but not in Firestore yet.
            // Ensure the canonical user doc exists at /users/{uid} so role-based UI works.
            if (!userDoc) {
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  '[Auth] No user doc for',
                  firebaseUser.uid,
                  '- creating in Firestore'
                )
              }
              // Google (and other IdPs) set firebaseUser.displayName; email/password users get it from the form or email prefix.
              const displayName =
                firebaseUser.displayName ??
                firebaseUser.email?.split('@')[0] ??
                'User'
              try {
                await createUser(
                  firebaseUser.uid,
                  firebaseUser.email ?? '',
                  displayName
                )
                recordAuditEventAPI({
                  action: 'user.created',
                  entityType: 'user',
                  entityId: firebaseUser.uid,
                  metadata: { source: 'auth_provider_backfill' },
                })
                if (process.env.NODE_ENV === 'development') {
                  console.log(
                    '[Auth] User document created in Firestore at users/%s',
                    firebaseUser.uid
                  )
                }
              } catch (createErr) {
                console.error(
                  'Failed to create user document in Firestore (check console and emulator connection):',
                  createErr
                )
                throw createErr
              }
              userDoc = await getDocument('users', firebaseUser.uid)
            }

            if (userDoc) {
              const role = normalizeUserRole(userDoc.role)
              const authEmail = firebaseUser.email ?? ''
              const firestoreEmail =
                typeof userDoc.email === 'string' ? userDoc.email : ''

              // After verifyBeforeUpdateEmail completes, Auth has the new
              // address while Firestore may still have the old one.
              if (
                authEmail &&
                firestoreEmail.toLowerCase() !== authEmail.toLowerCase()
              ) {
                try {
                  await updateProfileAPI({ syncEmail: true })
                } catch (syncErr) {
                  console.error('Failed to sync email to Firestore:', syncErr)
                }
              }

              const prev = useAuthStore.getState().userData
              const activeClubId = resolveHydratedActiveClubId({
                fromDoc: userDoc.activeClubId as string | null | undefined,
                prevUid: prev?.uid,
                prevActiveClubId: prev?.activeClubId,
                firebaseUid: firebaseUser.uid,
              })

              const userData: User = {
                uid: firebaseUser.uid,
                email: authEmail || firestoreEmail,
                displayName:
                  (userDoc.displayName as string) ??
                  firebaseUser.displayName ??
                  '',
                jerseyNumber: normalizeJerseyNumber(userDoc.jerseyNumber),
                position: userDoc.position ?? null,
                role,
                activeClubId,
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
        // Separate from `loading`: the 8s timeout clears loading while this
        // fetch is still in flight. Admin guards must wait for this flag.
        setProfileReady(true)
      }
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      unsubscribe()
    }
  }, [setUser, setUserData, setLoading, setProfileReady])

  return <>{children}</>
}
