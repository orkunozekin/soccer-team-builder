import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore'
import { db } from './config'

// Helper to convert Firestore timestamps to Date
export const timestampToDate = (timestamp: Timestamp | Date | null): Date | null => {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  return timestamp.toDate()
}

// Helper to convert Date to Firestore timestamp
export const dateToTimestamp = (date: Date | null): Timestamp | null => {
  if (!date) return null
  return Timestamp.fromDate(date)
}

// Generic CRUD helpers
export const createDocument = async (
  collectionName: string,
  documentId: string,
  data: DocumentData
): Promise<void> => {
  const docRef = doc(db, collectionName, documentId)
  await setDoc(docRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
}

export const getDocument = async (
  collectionName: string,
  documentId: string
): Promise<DocumentData | null> => {
  const docRef = doc(db, collectionName, documentId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return docSnap.data()
  }
  return null
}

export const updateDocument = async (
  collectionName: string,
  documentId: string,
  data: Partial<DocumentData>
): Promise<void> => {
  const docRef = doc(db, collectionName, documentId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export const deleteDocument = async (
  collectionName: string,
  documentId: string
): Promise<void> => {
  const docRef = doc(db, collectionName, documentId)
  await deleteDoc(docRef)
}

export const queryDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<DocumentData[]> => {
  const collectionRef = collection(db, collectionName)
  const q = query(collectionRef, ...constraints)
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}
