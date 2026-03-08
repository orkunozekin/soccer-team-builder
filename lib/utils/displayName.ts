/**
 * Format display name for pitch: full first name + last initial (if exists).
 * Truncates to maxLength to keep labels readable on the pitch.
 */
export function formatPitchDisplayName(
  displayName: string,
  maxLength: number = 14
): string {
  const trimmed = displayName.trim()
  if (!trimmed) return ''

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) {
    return parts[0].length > maxLength
      ? parts[0].slice(0, maxLength) + '…'
      : parts[0]
  }

  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  const formatted = `${firstName} ${lastInitial}.`

  if (formatted.length > maxLength) {
    return formatted.slice(0, maxLength) + '…'
  }
  return formatted
}
