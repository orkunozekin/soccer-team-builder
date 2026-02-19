import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
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

export const logoutUser = async (): Promise<void> => {
  return signOut(auth)
}

export const getCurrentUser = (): User | null => {
  return auth.currentUser
}
