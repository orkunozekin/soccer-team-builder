import {
  GoogleAuthProvider,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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
