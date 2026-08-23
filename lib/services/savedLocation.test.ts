import { describe, expect, it } from 'vitest'
import { serializeMatchLocation } from '@/lib/utils/location'
import type { SavedLocationInput } from '@/types/savedLocation'

describe('saved location payload', () => {
  it('serializeMatchLocation accepts saved location shape', () => {
    const input: SavedLocationInput = {
      name: 'Rec Sports Field 4',
      address: '123 Main St, Austin, TX',
      lat: 30.2672,
      lng: -97.7431,
    }

    expect(serializeMatchLocation(input)).toEqual(input)
  })

  it('serializeMatchLocation rejects empty saved location', () => {
    expect(
      serializeMatchLocation({
        name: '',
        address: '',
        lat: null,
        lng: null,
      })
    ).toBeNull()
  })
})
