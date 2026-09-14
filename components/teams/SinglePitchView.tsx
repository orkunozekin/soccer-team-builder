'use client'

import { PitchSurface } from './PitchSurface'
import { PlayerMarker } from './PlayerMarker'
import type { PlayerOnPitch } from '@/lib/utils/pitchLayout'
import { Team } from '@/types/team'

interface SinglePitchViewProps {
  team: Team
  players: PlayerOnPitch[]
  isMobile: boolean
  isAdmin: boolean
  onPlayerClick?: (userId: string, teamId: string | null) => void
  flipX?: boolean
  flipY?: boolean
  currentUserId?: string | null
}

export function SinglePitchView({
  team,
  players,
  isMobile,
  isAdmin,
  onPlayerClick,
  flipX = false,
  flipY = false,
  currentUserId = null,
}: SinglePitchViewProps) {
  const scaleX = flipX ? -1 : 1
  const scaleY = flipY ? -1 : 1
  const pitchTransform =
    scaleX === 1 && scaleY === 1
      ? undefined
      : `scaleX(${scaleX}) scaleY(${scaleY})`

  // IFAB vertical pitch: width/length = 68/105 (goals top & bottom).
  // Must match PitchMarkings viewBox or lines stretch incorrectly.
  const aspectRatio = `${68 / 105}`

  return (
    <div
      className="relative w-full animate-in fade-in-0 duration-300"
      style={{
        aspectRatio,
        transform: pitchTransform,
        transformOrigin: 'center',
      }}
    >
      <div className="relative h-full w-full overflow-visible">
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
            isCurrentUser={currentUserId === user.uid}
          />
        ))}
      </div>
    </div>
  )
}
