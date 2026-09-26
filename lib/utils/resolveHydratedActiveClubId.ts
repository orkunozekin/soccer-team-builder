/**
 * Resolve activeClubId when AuthProvider hydrates from Firestore.
 * Prefer the document value when set. If the doc is null/missing but the
 * same-uid client store already has a club (e.g. invite redeem raced ahead
 * of this getDocument), keep the client value instead of clobbering it.
 */
export function resolveHydratedActiveClubId(input: {
  fromDoc: string | null | undefined
  prevUid?: string | null
  prevActiveClubId?: string | null
  firebaseUid: string
}): string | null {
  const fromDoc =
    typeof input.fromDoc === 'string' && input.fromDoc.trim()
      ? input.fromDoc.trim()
      : null
  if (fromDoc) return fromDoc
  if (input.prevUid === input.firebaseUid && input.prevActiveClubId) {
    return input.prevActiveClubId
  }
  return null
}
