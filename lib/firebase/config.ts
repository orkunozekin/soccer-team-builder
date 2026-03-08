import { FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
let app: FirebaseApp
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

// Initialize Firebase services
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)

/** Call this on the client when using emulators (e.g. in EmulatorAuthGate). Ensures connection runs in browser, not during SSR. */
export function connectToEmulators(): void {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== 'true') return
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  if (process.env.NODE_ENV === 'development') {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '(not set)'
    console.log(
      '[Firebase] Using Auth + Firestore emulators (Auth: 127.0.0.1:9099, Firestore: 127.0.0.1:8080) — projectId:',
      projectId
    )
  }
}

export default app
