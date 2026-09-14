import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { auth } from './config'

export const registerUser = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return createUserWithEmailAndPassword(auth, email, password)
}

export const loginUser = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return signInWithEmailAndPassword(auth, email, password)
}

export const resetPassword = async (email: string): Promise<void> => {
  const response = await fetch('/api/auth/password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim() }),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      data?.error || 'Could not send a reset email. Please try again.'
    )
  }
}

export const loginWithGoogle = async (): Promise<UserCredential> => {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export const logoutUser = async (): Promise<void> => {
  return signOut(auth)
}

export const getCurrentUser = (): User | null => {
  return auth.currentUser
}

export const hasPasswordProvider = (user: User): boolean => {
  return user.providerData.some(provider => provider.providerId === 'password')
}

const reauthenticateWithPassword = async (
  user: User,
  password: string
): Promise<UserCredential> => {
  const email = user.email
  if (!email) {
    throw new Error('No email is associated with this account.')
  }
  const credential = EmailAuthProvider.credential(email, password)
  return reauthenticateWithCredential(user, credential)
}

export const updateUserPassword = async (
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await reauthenticateWithPassword(user, currentPassword)
  await updatePassword(user, newPassword)
}

export const requestEmailUpdate = async (
  user: User,
  currentPassword: string,
  newEmail: string
): Promise<void> => {
  const trimmedEmail = newEmail.trim()
  await reauthenticateWithPassword(user, currentPassword)
  const continueUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/profile`
      : undefined
  await verifyBeforeUpdateEmail(
    user,
    trimmedEmail,
    continueUrl
      ? { url: continueUrl, handleCodeInApp: false }
      : undefined
  )
}

export const getAuthErrorMessage = (
  error: unknown,
  fallback: string,
  context: 'login' | 'register' | 'profile' | 'google' = 'profile'
): string => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return context === 'login' || context === 'register'
        ? 'Incorrect email or password.'
        : 'Current password is incorrect.'
    case 'auth/user-not-found':
      return 'No account found with that email. Try creating an account.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact an admin for help.'
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign back in, then try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.'
    case 'auth/popup-blocked':
      return 'Pop-up was blocked. Allow pop-ups for this site and try again.'
    default:
      break
  }

  // Prefer mapped auth codes; avoid leaking raw Firebase strings to users.
  if (code.startsWith('auth/')) {
    return fallback
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
