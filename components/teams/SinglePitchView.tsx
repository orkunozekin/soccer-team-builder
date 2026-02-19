'use client'

import { Team } from '@/types/team'
import { PitchSurface } from './PitchSurface'
import { PlayerMarker } from './PlayerMarker'
import type { PlayerOnPitch } from '@/lib/utils/pitchLayout'

interface SinglePitchViewProps {
  team: Team
  players: PlayerOnPitch[]
  isMobile: boolean
  isAdmin: boolean
  onPlayerClick?: (userId: string, teamId: string | null) => void
  flipX?: boolean
  flipY?: boolean
}

export function SinglePitchView({
  team,
  players,
  isMobile,
  isAdmin,
  onPlayerClick,
  flipX = false,
  flipY = false,
}: SinglePitchViewProps) {
  const scaleX = flipX ? -1 : 1
  const scaleY = flipY ? -1 : 1
  const pitchTransform =
    scaleX === 1 && scaleY === 1
      ? undefined
      : `scaleX(${scaleX}) scaleY(${scaleY})`

  // Mobile: make the pitch a bit taller so it doesn't feel squished.
  // (aspect-ratio is width/height)
  const aspectRatio = isMobile ? '4/3' : '105/68'

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio,
        transform: pitchTransform,
        transformOrigin: 'center',
      }}
    >
      <div className="relative w-full h-full overflow-visible">
        <PitchSurface />
        {players.map(({ user, position }) => (
          <PlayerMarker
            key={user.uid}
            user={user}
            position={position}
            team={team}
            isMobile={isMobile}
            isAdmin={isAdmin}
            onPlayerClick={onPlayerClick}
            counterFlipX={flipX}
            counterFlipY={flipY}
          />
        ))}
      </div>
    </div>
  )
}
