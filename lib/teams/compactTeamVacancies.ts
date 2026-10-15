import { type TeamAssignment, isGoalkeeper } from '@/lib/utils/teamGenerator'

export interface VacancyPlayer {
  userId: string
  rsvpAt: Date | null
  position: string | null
}

/** Keep established roster order; only move players into vacancies from later teams. */
export function compactTeamVacancies(
  existingTeams: TeamAssignment[],
  players: VacancyPlayer[],
  options: {
    manualAssignments?: Record<string, number>
    capacities?: Map<number, number>
    targets?: Map<number, number>
  } = {}
): TeamAssignment[] {
  const byId = new Map(players.map(player => [player.userId, player]))
  const seen = new Set<string>()
  const teams = [...existingTeams]
    .sort((a, b) => a.teamNumber - b.teamNumber)
    .map(team => ({
      ...team,
      playerIds: team.playerIds.filter(id => {
        if (!byId.has(id) || seen.has(id)) return false
        seen.add(id)
        return true
      }),
    }))
  const isGk = (id: string) => isGoalkeeper(byId.get(id)?.position ?? null)
  // Unknown RSVP times follow known times; UID breaks ties independently of query order.
  const time = (id: string) => {
    const value = byId.get(id)?.rsvpAt?.getTime()
    return value != null && Number.isFinite(value) ? value : Infinity
  }
  const compare = (a: string, b: string) =>
    (time(a) < time(b) ? -1 : time(a) > time(b) ? 1 : 0) ||
    (a < b ? -1 : a > b ? 1 : 0)

  for (let i = 0; i < teams.length; i++) {
    const target = teams[i]
    const capacity = options.capacities?.get(target.teamNumber) ?? 11
    const targetSize = Math.min(
      options.targets?.get(target.teamNumber) ?? capacity,
      capacity
    )
    while (target.playerIds.length < targetSize) {
      const candidates = teams.slice(i + 1).flatMap(source =>
        source.playerIds
          .filter(id => {
            if (options.manualAssignments?.[id] != null) return false
            return !(
              target.teamNumber <= 2 &&
              isGk(id) &&
              target.playerIds.some(isGk)
            )
          })
          .map(id => ({ id, source }))
      )
      candidates.sort((a, b) => compare(a.id, b.id))
      const next = candidates[0]
      if (!next) break
      next.source.playerIds = next.source.playerIds.filter(id => id !== next.id)
      target.playerIds.push(next.id)
    }
  }
  return teams
}
