/**
 * Position to pitch coordinates mapping
 * Coordinates are relative (0-100%) for responsive design
 */
export interface PitchPosition {
  x: number // 0-100, left to right
  y: number // 0-100, top to bottom
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
  return (
    POSITION_COORDINATES[position.toUpperCase()] || { x: 50, y: 50 }
  )
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
