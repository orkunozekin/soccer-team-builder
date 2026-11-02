/** Default team size used by team generation (`Team.maxSize`). */
export const DEFAULT_TEAM_SIZE = 11

export interface RosterFill {
  confirmed: number
  /** Teams the confirmed players spread across (never fewer than `minTeams`). */
  teams: number
  /** Total spots across those teams. */
  capacity: number
  /** Open spots before every team is full. */
  remaining: number
}

/**
 * Matches have no hard cap: teams expand as players RSVP. "Fill" is progress
 * toward full teams, so the meter keeps a meaningful target at any headcount.
 */
export function getRosterFill(
  confirmed: number,
  teamSize = DEFAULT_TEAM_SIZE,
  minTeams = 2
): RosterFill {
  const safeConfirmed = Math.max(0, Math.floor(confirmed))
  const teams = Math.max(minTeams, Math.ceil(safeConfirmed / teamSize))
  const capacity = teams * teamSize
  return {
    confirmed: safeConfirmed,
    teams,
    capacity,
    remaining: capacity - safeConfirmed,
  }
}

export function describeRosterFill({ teams, remaining }: RosterFill): string {
  if (remaining === 0) return `${teams} full teams`
  const spots = remaining === 1 ? 'spot' : 'spots'
  return `${remaining} ${spots} to fill ${teams} teams`
}
