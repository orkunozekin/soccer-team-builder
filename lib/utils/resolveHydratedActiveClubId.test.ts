import { describe, expect, it } from 'vitest'
import { resolveHydratedActiveClubId } from './resolveHydratedActiveClubId'

describe('resolveHydratedActiveClubId', () => {
  it('keeps client activeClubId when Firestore read is still null', () => {
    expect(
      resolveHydratedActiveClubId({
        fromDoc: null,
        prevUid: 'u1',
        prevActiveClubId: 'club-a',
        firebaseUid: 'u1',
      })
    ).toBe('club-a')
  })

  it('prefers Firestore activeClubId when present', () => {
    expect(
      resolveHydratedActiveClubId({
        fromDoc: 'club-from-doc',
        prevUid: 'u1',
        prevActiveClubId: 'club-client',
        firebaseUid: 'u1',
      })
    ).toBe('club-from-doc')
  })

  it('ignores client value from a different uid', () => {
    expect(
      resolveHydratedActiveClubId({
        fromDoc: null,
        prevUid: 'other',
        prevActiveClubId: 'club-a',
        firebaseUid: 'u1',
      })
    ).toBeNull()
  })
})
