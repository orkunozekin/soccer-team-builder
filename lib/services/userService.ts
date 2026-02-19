import { createDocument, getDocument, updateDocument, queryDocuments, queryDocumentsPaginated, getCollectionCount, timestampToDate } from '@/lib/firebase/firestore'
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
    // Precomputed fields for server-side prefix search
    emailLower: email.toLowerCase(),
    displayNameLower: displayName.toLowerCase(),
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
  return users.map((user: Record<string, unknown>) => mapDocToUser(user))
}

const mapDocToUser = (user: Record<string, unknown>): User => ({
  uid: user.uid as string,
  email: user.email as string,
  displayName: user.displayName as string,
  jerseyNumber: (user.jerseyNumber as number | null) ?? null,
  position: (user.position as string | null) ?? null,
  role: (user.role as User['role']) || 'user',
  createdAt: timestampToDate(user.createdAt as never) || new Date(),
  updatedAt: timestampToDate(user.updatedAt as never) || new Date(),
})

export const getUsersPaginated = async (
  pageSize: number,
  cursor?: string | null
): Promise<{ users: User[]; nextCursor: string | null }> => {
  const { documents, nextCursor } = await queryDocumentsPaginated(
    'users',
    'uid',
    pageSize,
    cursor
  )
  const users = documents.map((d) => mapDocToUser(d as Record<string, unknown>))
  return { users, nextCursor }
}

export const getUsersCount = async (): Promise<number> => {
  return getCollectionCount('users')
}

export const updateUser = async (
  uid: string,
  updates: Partial<Pick<User, 'displayName' | 'jerseyNumber' | 'position' | 'role'>>
): Promise<void> => {
  await updateDocument('users', uid, updates)
}
