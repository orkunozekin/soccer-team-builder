import { orderBy } from 'firebase/firestore'
import { queryDocuments, timestampToDate } from '@/lib/firebase/firestore'
import { parseMatchLocation } from '@/lib/utils/location'
import type { SavedLocation } from '@/types/savedLocation'

function mapDocToSavedLocation(
  doc: Record<string, unknown>,
  id: string
): SavedLocation | null {
  const parsed = parseMatchLocation(doc)
  if (!parsed) return null

  return {
    id,
    name: parsed.name,
    address: parsed.address,
    lat: parsed.lat,
    lng: parsed.lng,
    createdAt: timestampToDate(doc.createdAt as never) || new Date(),
    updatedAt: timestampToDate(doc.updatedAt as never) || new Date(),
  }
}

export async function getAllSavedLocations(): Promise<SavedLocation[]> {
  const docs = await queryDocuments('savedLocations', [orderBy('name', 'asc')])

  return docs
    .map(doc => mapDocToSavedLocation(doc, (doc.id as string) || ''))
    .filter((loc): loc is SavedLocation => loc != null)
}
