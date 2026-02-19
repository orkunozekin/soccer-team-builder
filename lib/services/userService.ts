import { createDocument, getDocument, updateDocument } from '@/lib/firebase/firestore'
import { User, UserFirestore } from '@/types/user'
import { timestampToDate } from '@/lib/firebase/firestore'

export const createUser = async (
  uid: string,
  email: string,
  displayName: string
): Promise<void> => {
  const userData: Omit<UserFirestore, 'createdAt' | 'updatedAt'> = {
    uid,
    email,
    displayName,
    jerseyNumber: null,
    position: null,
    role: 'user',
  }

  await createDocument('users', uid, userData)
}

export const getUser = async (uid: string): Promise<User | null> => {
  const userDoc = await getDocument('users', uid)
  if (!userDoc) return null

  return {
    uid: userDoc.uid,
    email: userDoc.email,
    displayName: userDoc.displayName,
    jerseyNumber: userDoc.jerseyNumber ?? null,
    position: userDoc.position ?? null,
    role: userDoc.role || 'user',
    createdAt: timestampToDate(userDoc.createdAt) || new Date(),
    updatedAt: timestampToDate(userDoc.updatedAt) || new Date(),
  }
}

export const updateUser = async (
  uid: string,
  updates: Partial<Pick<User, 'displayName' | 'jerseyNumber' | 'position'>>
): Promise<void> => {
  await updateDocument('users', uid, updates)
}
