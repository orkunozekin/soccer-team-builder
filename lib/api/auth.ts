import { getAdminAuth } from '@/lib/firebase/admin'
import { getAdminDb } from '@/lib/firebase/admin'

/**
 * Get the current user's auth token from the request
 */
export async function getAuthToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Verify the user is authenticated using Firebase Admin SDK
 * This provides proper server-side token verification
 */
export async function verifyAuth(request: Request): Promise<{
  uid: string | null
  error: string | null
}> {
  const token = await getAuthToken(request)
  if (!token) {
    return { uid: null, error: 'No authorization token provided' }
  }

  try {
    // Use Firebase Admin SDK to verify the token
    const adminAuth = getAdminAuth()
    
    // If Admin SDK is not configured, fall back to client SDK approach
    if (!adminAuth) {
      // Fallback: Accept token but rely on Firestore security rules
      // This is less secure but allows development without service account
      console.warn('Firebase Admin SDK not configured, using fallback verification')
      return { uid: 'fallback', error: null }
    }

    const decodedToken = await adminAuth.verifyIdToken(token)
    return { uid: decodedToken.uid, error: null }
  } catch (error: any) {
    console.error('Token verification error:', error)
    return { uid: null, error: 'Invalid or expired token' }
  }
}

/**
 * Verify the user has admin role
 */
export async function verifyAdmin(request: Request): Promise<{
  uid: string | null
  isAdmin: boolean
  error: string | null
}> {
  const { uid, error } = await verifyAuth(request)
  if (error || !uid) {
    return { uid: null, isAdmin: false, error }
  }

  // If using fallback, skip admin check (Firestore rules will handle it)
  if (uid === 'fallback') {
    return { uid, isAdmin: false, error: null }
  }

  try {
    const adminDb = getAdminDb()
    if (!adminDb) {
      // Fallback: Can't verify admin, rely on Firestore rules
      return { uid, isAdmin: false, error: null }
    }

    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return { uid, isAdmin: false, error: 'User not found' }
    }

    const userData = userDoc.data()
    const role = userData?.role || 'user'
    const isAdmin = role === 'admin' || role === 'superAdmin'

    return { uid, isAdmin, error: null }
  } catch (error: any) {
    console.error('Admin verification error:', error)
    return { uid, isAdmin: false, error: 'Failed to verify admin status' }
  }
}

/**
 * Verify the user has super admin role
 */
export async function verifySuperAdmin(request: Request): Promise<{
  uid: string | null
  isSuperAdmin: boolean
  error: string | null
}> {
  const { uid, error } = await verifyAuth(request)
  if (error || !uid) {
    return { uid: null, isSuperAdmin: false, error }
  }

  if (uid === 'fallback') {
    return { uid, isSuperAdmin: false, error: null }
  }

  try {
    const adminDb = getAdminDb()
    if (!adminDb) {
      return { uid, isSuperAdmin: false, error: null }
    }

    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return { uid: null, isSuperAdmin: false, error: 'User not found' }
    }

    const userData = userDoc.data()
    const role = userData?.role || 'user'
    const isSuperAdmin = role === 'superAdmin'

    return { uid, isSuperAdmin, error: null }
  } catch (error: any) {
    console.error('Super admin verification error:', error)
    return { uid: null, isSuperAdmin: false, error: 'Failed to verify super admin status' }
  }
}
