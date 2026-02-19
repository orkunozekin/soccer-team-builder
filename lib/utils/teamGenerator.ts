import { RSVP } from '@/types/rsvp'
import { User } from '@/types/user'

/**
 * Helper function to check if position is goalkeeper
 * Handles 'GK', 'Goalkeeper', case variations
 */
export function isGoalkeeper(position: string | null): boolean {
  if (!position) return false
  const normalized = position.toUpperCase().trim()
  const gkPositions = ['GK', 'GOALKEEPER', 'GOALIE', 'KEEPER']
  return gkPositions.includes(normalized) || normalized.includes('GOALKEEPER')
}

interface TeamAssignment {
  teamNumber: number
  playerIds: string[]
}

export function computeTeamCountForRSVPCount(
  rsvpCount: number,
  maxTeamSize: number = 11,
  baseTeams: number = 2
): number {
  const baseCapacity = baseTeams * maxTeamSize
  const extraPlayers = Math.max(0, rsvpCount - baseCapacity)
  const extraTeams = Math.floor(extraPlayers / maxTeamSize)
  return Math.max(baseTeams, baseTeams + extraTeams)
}

export function generateTeams(
  rsvps: RSVP[],
  users: User[],
  maxTeamSize: number = 11,
  options?: { teamCount?: number }
): TeamAssignment[] {
  // 1. Separate players by priority
  const goalkeepers: RSVP[] = []
  const admins: RSVP[] = []
  const regularPlayers: RSVP[] = []

  rsvps.forEach((rsvp) => {
    const user = users.find((u) => u.uid === rsvp.userId)
    if (!user) return

    if (isGoalkeeper(user.position)) {
      goalkeepers.push(rsvp)
    } else if (user.role === 'admin' || user.role === 'superAdmin') {
      admins.push(rsvp)
    } else {
      regularPlayers.push(rsvp)
    }
  })

  // 2. Create teams (at least 2)
  const teamCount =
    options?.teamCount ?? Math.max(2, Math.ceil(rsvps.length / maxTeamSize))
  const teams: TeamAssignment[] = Array.from({ length: teamCount }, (_, i) => ({
    teamNumber: i + 1,
    playerIds: [],
  }))

  // 3. Assign goalkeepers to first two teams (max 1 per team)
  goalkeepers.forEach((gk, idx) => {
    if (idx < 2 && teams[idx]) {
      teams[idx].playerIds.push(gk.userId)
    }
  })

  // 4. Assign admins to first two teams
  admins.forEach((admin, idx) => {
    const teamIdx = idx % 2
    if (teams[teamIdx] && teams[teamIdx].playerIds.length < maxTeamSize) {
      teams[teamIdx].playerIds.push(admin.userId)
    }
  })

  // 5. Fill remaining spots first come first serve
  regularPlayers.forEach((player) => {
    // Find team with most space
    const team = teams.reduce((min, t) =>
      t.playerIds.length < min.playerIds.length ? t : min
    )
    if (team.playerIds.length < maxTeamSize) {
      team.playerIds.push(player.userId)
    }
  })

  return teams
}
