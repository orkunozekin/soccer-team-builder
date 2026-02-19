import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let adminApp: App | null = null
let adminAuth: Auth | null = null
let adminDb: Firestore | null = null

/**
 * Initialize Firebase Admin SDK
 * 
 * For development: Can use service account JSON or application default credentials
 * For production: Use service account JSON file or environment variables
 * 
 * Setup options:
 * 1. Service Account JSON file (recommended for local dev):
 *    - Download from Firebase Console → Project Settings → Service Accounts
 *    - Save as `firebase-service-account.json` in project root
 *    - Add to .gitignore
 * 
 * 2. Environment variables (recommended for production):
 *    - Set GOOGLE_APPLICATION_CREDENTIALS or individual credential env vars
 */
export function initializeAdmin(): App | null {
  if (adminApp) {
    return adminApp
  }

  // Check if already initialized
  if (getApps().length > 0) {
    adminApp = getApps()[0]
    return adminApp
  }

  // Try to initialize with service account
  try {
    // Option 1: Service account JSON as environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      })
      return adminApp
    }

    // Option 2: Use application default credentials (for Cloud Run, GCP, etc.)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = initializeApp()
      return adminApp
    }

    // Option 3: Try to load from file (for local development)
    try {
      adminApp = initializeApp()
      return adminApp
    } catch {
      // If that fails, we'll use fallback
    }

    // Fallback: Admin SDK not configured
    console.warn(
      'Firebase Admin SDK not configured. API routes will use fallback verification. ' +
        'For proper security, set up service account credentials. ' +
        'See ARCHITECTURE.md for setup instructions.'
    )
    return null
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error)
    return null
  }
}

export function getAdminAuth(): Auth | null {
  if (!adminAuth) {
    const app = initializeAdmin()
    if (app) {
      adminAuth = getAuth(app)
    }
  }
  return adminAuth
}

export function getAdminDb(): Firestore | null {
  if (!adminDb) {
    const app = initializeAdmin()
    if (app) {
      adminDb = getFirestore(app)
    }
  }
  return adminDb
}
