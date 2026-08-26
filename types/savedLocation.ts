export interface SavedLocation {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  createdAt: Date
  updatedAt: Date
}

export type SavedLocationInput = Pick<
  SavedLocation,
  'name' | 'address' | 'lat' | 'lng'
>
