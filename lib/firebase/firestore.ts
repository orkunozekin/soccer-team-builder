import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
  orderBy,
  startAfter,
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

/** Paginated query ordered by a field. Returns documents and cursor for next page. */
export const queryDocumentsPaginated = async (
  collectionName: string,
  orderByField: string,
  pageSize: number,
  cursorValue?: string | null
): Promise<{ documents: DocumentData[]; nextCursor: string | null }> => {
  const collectionRef = collection(db, collectionName)
  const constraints: QueryConstraint[] = [
    orderBy(orderByField),
    limit(pageSize + 1), // fetch one extra to know if there's a next page
  ]
  if (cursorValue != null && cursorValue !== '') {
    constraints.push(startAfter(cursorValue))
  }
  const q = query(collectionRef, ...constraints)
  const querySnapshot = await getDocs(q)
  const docs = querySnapshot.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs
  const documents = pageDocs.map((d) => ({ id: d.id, ...d.data() }))
  const lastDoc = pageDocs[pageDocs.length - 1]
  const nextCursor =
    hasMore && lastDoc
      ? (lastDoc.data()[orderByField] as string) ?? lastDoc.id
      : null
  return { documents, nextCursor }
}

/** Get total document count for a collection (for pagination UI). */
export const getCollectionCount = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<number> => {
  const collectionRef = collection(db, collectionName)
  const q = query(collectionRef, ...constraints)
  const snapshot = await getCountFromServer(q)
  return snapshot.data().count
}
