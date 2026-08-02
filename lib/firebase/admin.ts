import { App, cert, getApps, initializeApp } from 'firebase-admin/app'
import { Auth, getAuth } from 'firebase-admin/auth'
import { Firestore, getFirestore } from 'firebase-admin/firestore'

let adminApp: App | null = null
let adminAuth: Auth | null = null
let adminDb: Firestore | null = null

function usingEmulators(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
}

/**
 * Initialize Firebase Admin SDK
 *
 * For development: Can use service account JSON or application default credentials
 * For production: Use service account JSON file or environment variables
 *
 * When Auth/Firestore emulator hosts are set, initializes with projectId only
 * (no service account file required).
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

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT

  try {
    // Emulator mode: no real credentials needed
    if (usingEmulators()) {
      adminApp = initializeApp(projectId ? { projectId } : undefined)
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[Firebase Admin] Emulator mode (Auth/Firestore). projectId:',
          projectId ?? '(default)'
        )
      }
      return adminApp
    }

    // Option 1: Service account JSON as environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      )
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        ...(projectId ? { projectId } : {}),
      })
      return adminApp
    }

    // Option 2: Application default credentials / GCP metadata
    // (GOOGLE_APPLICATION_CREDENTIALS is picked up by the Admin SDK itself)
    try {
      adminApp = initializeApp(projectId ? { projectId } : undefined)
      return adminApp
    } catch {
      // If that fails, we'll use fallback
    }

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
