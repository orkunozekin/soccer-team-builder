export type UserRole = 'user' | 'admin' | 'superAdmin'

export interface User {
  uid: string
  email: string
  displayName: string
  jerseyNumber: number | null
  position: string | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface UserFirestore {
  uid: string
  email: string
  displayName: string
  jerseyNumber: number | null
  position: string | null
  role: UserRole
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}
