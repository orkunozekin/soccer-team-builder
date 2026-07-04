/**
 * Normalize jersey numbers from Firestore / forms (number, string, null).
 */
export function normalizeJerseyNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > 99) return null
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = parseInt(trimmed, 10)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) return null
    return parsed
  }
  return null
}

export function formatJerseyDisplay(
  jerseyNumber: number | null | undefined
): string {
  const normalized = normalizeJerseyNumber(jerseyNumber)
  return normalized != null ? String(normalized) : ''
}
