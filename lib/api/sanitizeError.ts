/**
 * Returns a message safe to show to the end user. Never exposes Firebase,
 * Firestore, or other internal/database error text.
 */
export function sanitizeErrorForClient(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  if (!msg || typeof msg !== 'string') return fallback
  const s = msg.trim()
  // Firebase / Firestore / database / network internal errors – never expose to user
  if (
    /ABORTED|Transaction|lock timeout|PERMISSION_DENIED|FAILED_PRECONDITION|auth\/|firestore|FirebaseError|Firebase/i.test(s) ||
    /NOT_FOUND|ALREADY_EXISTS|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|INTERNAL/i.test(s) ||
    /Missing or insufficient permissions|Permission denied/i.test(s) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(s) ||
    /^\d+\s+[A-Z_]+/i.test(s) || // e.g. "10 ABORTED: ..."
    (s.includes('\n') && s.includes(' at ')) // stack trace
  ) {
    return fallback
  }
  return s
}
