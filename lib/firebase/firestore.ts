import {
  CollectionReference,
  DocumentData,
  QueryConstraint,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
} from 'firebase/firestore'
import { db } from './config'

/** Build a collection reference; supports subcollections via path like 'matches/matchId/teams'. */
function getCollectionRef(collectionPath: string): CollectionReference {
  const segments = collectionPath.split('/').filter(Boolean)
  if (segments.length === 1) return collection(db, segments[0])
  // Subcollection: e.g. ['matches', 'match_123', 'teams'] -> collection(doc(db, 'matches', 'match_123'), 'teams')
  const parentPath = segments.slice(0, -1)
  const lastSegment = segments[segments.length - 1]
  const parentRef = doc(db, parentPath[0], ...parentPath.slice(1))
  return collection(parentRef, lastSegment)
}

/** Build a document reference; supports subcollections via path like 'matches/matchId/teams'. */
function getDocRef(collectionPath: string, documentId: string) {
  const segments = collectionPath.split('/').filter(Boolean)
  if (segments.length === 1) return doc(db, collectionPath, documentId)
  const first = segments[0]
  const rest = segments.slice(1)
  return doc(db, first, ...rest, documentId)
}

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

// Generic CRUD helpers (collectionName can be a path like 'matches/matchId/teams' for subcollections)
export const createDocument = async (
  collectionName: string,
  documentId: string,
  data: DocumentData
): Promise<void> => {
  const docRef = getDocRef(collectionName, documentId)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Firestore] Writing document', collectionName + '/' + documentId)
  }
  try {
    await setDoc(docRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Firestore] setDoc failed:', err)
    }
    throw err
  }
}

export const getDocument = async (
  collectionName: string,
  documentId: string
): Promise<DocumentData | null> => {
  const docRef = getDocRef(collectionName, documentId)
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
  const docRef = getDocRef(collectionName, documentId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export const deleteDocument = async (
  collectionName: string,
  documentId: string
): Promise<void> => {
  const docRef = getDocRef(collectionName, documentId)
  await deleteDoc(docRef)
}

export const queryDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<DocumentData[]> => {
  const collectionRef = getCollectionRef(collectionName)
  const q = query(collectionRef, ...constraints)
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

/**
 * Query a collection by path. Use this for subcollections (e.g. 'matches/matchId/teams').
 * Top-level collections work too (e.g. 'users', 'rsvps').
 */
export const queryCollectionAtPath = queryDocuments

/** Paginated query ordered by a field. Returns documents and cursor for next page. */
export const queryDocumentsPaginated = async (
  collectionName: string,
  orderByField: string,
  pageSize: number,
  cursorValue?: string | null
): Promise<{ documents: DocumentData[]; nextCursor: string | null }> => {
  const collectionRef = getCollectionRef(collectionName)
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
  const collectionRef = getCollectionRef(collectionName)
  const q = query(collectionRef, ...constraints)
  const snapshot = await getCountFromServer(q)
  return snapshot.data().count
}
