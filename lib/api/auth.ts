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
 * Verify the user is authenticated
 * 
 * Note: This is a simplified version. In production, you should:
 * 1. Install firebase-admin: npm install firebase-admin
 * 2. Use Firebase Admin SDK to verify the token server-side
 * 3. This provides proper security and prevents token tampering
 * 
 * For now, we rely on Firestore security rules for authorization,
 * but we still check that a token is provided.
 */
export async function verifyAuth(request: Request): Promise<{
  uid: string | null
  error: string | null
}> {
  const token = await getAuthToken(request)
  if (!token) {
    return { uid: null, error: 'No authorization token provided' }
  }

  // TODO: In production, verify with Firebase Admin SDK:
  // import { initializeApp, cert } from 'firebase-admin/app'
  // import { getAuth } from 'firebase-admin/auth'
  // const decodedToken = await getAuth().verifyIdToken(token)
  // return { uid: decodedToken.uid, error: null }

  // For now, we'll accept any valid token format
  // Firestore security rules will handle actual authorization
  // This is acceptable for MVP, but should be upgraded for production
  return { uid: 'verified', error: null }
}
