import { DEFAULT_SKILL } from '@/lib/skill/scoring'
import type { TeamStrength, TeamStrengthSummary } from '@/types/skill'

export interface SkillBalanceTeam {
  teamNumber: number
  playerIds: string[]
}

/** Swaps must shrink the gap by more than this to count (float noise guard). */
const IMPROVEMENT_EPSILON = 1e-9

function scoreOf(
  scoreByUserId: ReadonlyMap<string, number>,
  uid: string
): number {
  const score = scoreByUserId.get(uid)
  return typeof score === 'number' && Number.isFinite(score)
    ? score
    : DEFAULT_SKILL
}

/**
 * Split the movable players of one matchup pair to minimize the gap in total
 * skill. Locked players stay at their slot index; each team keeps its number
 * of movable slots, so sizes and locked placements never change.
 */
function balancePair<T extends SkillBalanceTeam>(
  teamA: T,
  teamB: T,
  scoreByUserId: ReadonlyMap<string, number>,
  locked: ReadonlySet<string>
): [T, T] {
  const all = [...teamA.playerIds, ...teamB.playerIds]
  // Defensive: a uid on both teams would make slot accounting ambiguous.
  if (new Set(all).size !== all.length) return [teamA, teamB]

  const isMovable = (uid: string) => !locked.has(uid)
  const slotsA = teamA.playerIds.filter(isMovable).length
  const slotsB = teamB.playerIds.filter(isMovable).length
  if (slotsA + slotsB < 2) return [teamA, teamB]

  // Pool in input order (team A then team B); used for stable sorts and slot fill.
  const pool = all.filter(isMovable)
  const orderIndex = new Map(pool.map((uid, i) => [uid, i]))
  const score = (uid: string) => scoreOf(scoreByUserId, uid)

  let totalA = teamA.playerIds
    .filter(uid => !isMovable(uid))
    .reduce((sum, uid) => sum + score(uid), 0)
  let totalB = teamB.playerIds
    .filter(uid => !isMovable(uid))
    .reduce((sum, uid) => sum + score(uid), 0)

  // Greedy seed: strongest first onto the side with the lower running total.
  const sorted = [...pool].sort(
    (x, y) => score(y) - score(x) || orderIndex.get(x)! - orderIndex.get(y)!
  )
  const sideA: string[] = []
  const sideB: string[] = []
  for (const uid of sorted) {
    const aHasRoom = sideA.length < slotsA
    const bHasRoom = sideB.length < slotsB
    if (aHasRoom && (!bHasRoom || totalA <= totalB)) {
      sideA.push(uid)
      totalA += score(uid)
    } else {
      sideB.push(uid)
      totalB += score(uid)
    }
  }

  // Improve: apply the best strictly-improving pairwise swap until none remains.
  for (;;) {
    const diff = totalA - totalB
    let bestGap = Math.abs(diff)
    let best: [number, number] | null = null
    for (let i = 0; i < sideA.length; i++) {
      const sa = score(sideA[i])
      for (let j = 0; j < sideB.length; j++) {
        const delta = sa - score(sideB[j])
        const gap = Math.abs(diff - 2 * delta)
        if (gap < bestGap - IMPROVEMENT_EPSILON) {
          bestGap = gap
          best = [i, j]
        }
      }
    }
    if (!best) break
    const [i, j] = best
    const a = sideA[i]
    const b = sideB[j]
    sideA[i] = b
    sideB[j] = a
    const delta = score(a) - score(b)
    totalA -= delta
    totalB += delta
  }

  const byInputOrder = (x: string, y: string) =>
    orderIndex.get(x)! - orderIndex.get(y)!
  const fill = (team: T, side: string[]): T => {
    const queue = [...side].sort(byInputOrder)
    let next = 0
    return {
      ...team,
      playerIds: team.playerIds.map(uid =>
        isMovable(uid) ? queue[next++] : uid
      ),
    }
  }
  return [fill(teamA, sideA), fill(teamB, sideB)]
}

/**
 * Rebalance unlocked players within each matchup pair (teams 1&2, 3&4, … by
 * `teamNumber`) to minimize the difference in total skill. An unpaired last
 * team is left untouched. Pure and deterministic: returns new team objects in
 * the input order and never mutates the inputs. Unknown scores count as
 * DEFAULT_SKILL.
 */
export function balanceTeamsBySkill<T extends SkillBalanceTeam>(
  teams: readonly T[],
  scoreByUserId: ReadonlyMap<string, number>,
  locked: ReadonlySet<string>
): T[] {
  const result: T[] = teams.map(team => ({
    ...team,
    playerIds: [...team.playerIds],
  }))
  const order = result
    .map((team, index) => ({ team, index }))
    .sort((x, y) => x.team.teamNumber - y.team.teamNumber || x.index - y.index)

  for (let p = 0; p + 1 < order.length; p += 2) {
    const first = order[p]
    const second = order[p + 1]
    const [a, b] = balancePair(first.team, second.team, scoreByUserId, locked)
    result[first.index] = a
    result[second.index] = b
  }
  return result
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Per-team strength (total, average, size; rounded to 2 decimals) sorted by
 * `teamNumber`, plus how many players on these teams were unrated.
 */
export function summarizeTeamStrength(
  teams: readonly SkillBalanceTeam[],
  scoreByUserId: ReadonlyMap<string, number>,
  unratedUserIds: Iterable<string> = []
): TeamStrengthSummary {
  const unrated = new Set(unratedUserIds)
  let unratedCount = 0
  const summaries: TeamStrength[] = [...teams]
    .sort((x, y) => x.teamNumber - y.teamNumber)
    .map(team => {
      const size = team.playerIds.length
      const total = team.playerIds.reduce(
        (sum, uid) => sum + scoreOf(scoreByUserId, uid),
        0
      )
      unratedCount += team.playerIds.filter(uid => unrated.has(uid)).length
      return {
        teamNumber: team.teamNumber,
        total: round2(total),
        average: size > 0 ? round2(total / size) : 0,
        size,
      }
    })
  return { teams: summaries, unratedCount }
}
