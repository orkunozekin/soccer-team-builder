import type { MatchStatusTone } from '@/lib/utils/matchStatus'

/** Text colour for a status line written as plain text (not a pill). */
export const MATCH_STATUS_TEXT_CLASS: Record<MatchStatusTone, string> = {
  live: 'text-[#FFB3AA]',
  success: 'text-lime',
  neutral: 'text-fog',
  muted: 'text-fog',
}
