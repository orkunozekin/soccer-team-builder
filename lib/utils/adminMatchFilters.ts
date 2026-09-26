import { isMatchPast } from '@/lib/utils/rsvpScheduler'
import type { Match } from '@/types/match'

export type MatchFilter = 'all' | 'upcoming' | 'past'

function compareMatchChronological(a: Match, b: Match): number {
  const dateCompare = a.date.getTime() - b.date.getTime()
  if (dateCompare !== 0) return dateCompare
  return (a.time || '').localeCompare(b.time || '')
}

/**
 * Filter admin match lists. Past matches are newest-first; upcoming/all are
 * chronological (soonest / oldest first).
 */
export function filterMatches(matches: Match[], filter: MatchFilter): Match[] {
  const filtered =
    filter === 'all'
      ? [...matches]
      : filter === 'past'
        ? matches.filter(m => isMatchPast(m.date, m.time))
        : matches.filter(m => !isMatchPast(m.date, m.time))

  filtered.sort((a, b) =>
    filter === 'past'
      ? compareMatchChronological(b, a)
      : compareMatchChronological(a, b)
  )
  return filtered
}
