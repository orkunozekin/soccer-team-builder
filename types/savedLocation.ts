export interface SavedLocation {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  /** Owning club (tenant). Required for new locations; backfilled for existing. */
  clubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export type SavedLocationInput = Pick<
  SavedLocation,
  'name' | 'address' | 'lat' | 'lng'
>
