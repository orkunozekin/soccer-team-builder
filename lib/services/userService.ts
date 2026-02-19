import { createDocument, getDocument, updateDocument, queryDocuments, timestampToDate } from '@/lib/firebase/firestore'
import { User, UserFirestore } from '@/types/user'

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

export const getAllUsers = async (): Promise<User[]> => {
  const users = await queryDocuments('users', [])

  return users.map((user: any) => ({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    jerseyNumber: user.jerseyNumber ?? null,
    position: user.position ?? null,
    role: user.role || 'user',
    createdAt: timestampToDate(user.createdAt) || new Date(),
    updatedAt: timestampToDate(user.updatedAt) || new Date(),
  }))
}

export const updateUser = async (
  uid: string,
  updates: Partial<Pick<User, 'displayName' | 'jerseyNumber' | 'position' | 'role'>>
): Promise<void> => {
  await updateDocument('users', uid, updates)
}
