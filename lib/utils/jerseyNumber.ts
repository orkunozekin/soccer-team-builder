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

/** Zero-width space: invisible, but breaks mobile address/phone data detectors. */
const ZWSP = '\u200B'

/**
 * Insert zero-width spaces between characters so browsers do not treat nearby
 * jersey + name + position text (e.g. "10 Joel Hawbaker ST") as a street address.
 */
export function breakAddressAutolink(text: string): string {
  if (text.length <= 1) return text
  return text.split('').join(ZWSP)
}

export function formatJerseyDisplay(
  jerseyNumber: number | null | undefined
): string {
  const normalized = normalizeJerseyNumber(jerseyNumber)
  if (normalized == null) return ''
  return breakAddressAutolink(String(normalized))
}

/** Position codes like ST look like "Street" next to a jersey number + name. */
export function formatPositionDisplay(
  position: string | null | undefined
): string {
  if (!position) return ''
  return breakAddressAutolink(position)
}
