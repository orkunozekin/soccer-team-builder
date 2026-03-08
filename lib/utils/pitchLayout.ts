import type { Team } from '@/types/team'
import type { User } from '@/types/user'

/**
 * Position to pitch coordinates mapping
 * Coordinates are relative (0-100%) for responsive design
 */
export interface PitchPosition {
  x: number // 0-100, left to right
  y: number // 0-100, top to bottom
}

export interface PlayerOnPitch {
  user: User
  position: PitchPosition
}

/**
 * Map a team's players to pitch positions (grouped by position with offsets).
 */
export function getTeamPlayers(team: Team, users: User[]): PlayerOnPitch[] {
  const teamUsers = team.playerIds
    .map(id => users.find(u => u.uid === id))
    .filter((u): u is User => !!u)

  const positionGroups: Record<string, User[]> = {}
  teamUsers.forEach(user => {
    const pos = user.position || 'CM'
    if (!positionGroups[pos]) positionGroups[pos] = []
    positionGroups[pos].push(user)
  })

  const players: PlayerOnPitch[] = []
  Object.entries(positionGroups).forEach(([position, positionUsers]) => {
    const basePos = getPitchPosition(position)
    positionUsers.forEach((user, index) => {
      const offsetPos = getOffsetPosition(basePos, index, positionUsers.length)
      players.push({ user, position: offsetPos })
    })
  })
  return players
}

const POSITION_COORDINATES: Record<string, PitchPosition> = {
  // Goalkeeper
  GK: { x: 50, y: 5 },

  // Defenders
  LB: { x: 15, y: 25 },
  LWB: { x: 10, y: 30 },
  CB: { x: 50, y: 20 },
  RWB: { x: 90, y: 30 },
  RB: { x: 85, y: 25 },

  // Midfielders
  CDM: { x: 50, y: 40 },
  LM: { x: 20, y: 50 },
  CM: { x: 50, y: 50 },
  CAM: { x: 50, y: 60 },
  RM: { x: 80, y: 50 },

  // Forwards
  LW: { x: 25, y: 75 },
  CF: { x: 50, y: 80 },
  ST: { x: 50, y: 85 },
  RW: { x: 75, y: 75 },
}

export function getPitchPosition(position: string | null): PitchPosition {
  if (!position) return { x: 50, y: 50 } // Default center
  return POSITION_COORDINATES[position.toUpperCase()] || { x: 50, y: 50 }
}

/**
 * For multiple players in same position, offset them slightly
 */
export function getOffsetPosition(
  basePosition: PitchPosition,
  index: number,
  total: number
): PitchPosition {
  const offsetX = (index - (total - 1) / 2) * 8 // Spread horizontally
  return {
    x: Math.max(5, Math.min(95, basePosition.x + offsetX)),
    y: basePosition.y,
  }
}
