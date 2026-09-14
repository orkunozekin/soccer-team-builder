'use client'

import { PitchSurface } from './PitchSurface'
import { PlayerMarker } from './PlayerMarker'
import type { PlayerOnPitch } from '@/lib/utils/pitchLayout'
import { Team } from '@/types/team'

interface DualTeamPitchViewProps {
  teamTop: Team
  teamBottom: Team
  playersTop: PlayerOnPitch[]
  playersBottom: PlayerOnPitch[]
  isMobile: boolean
  isAdmin: boolean
  onPlayerClick?: (userId: string, teamId: string | null) => void
  currentUserId?: string | null
}

/**
 * One mirrored pitch for teams 1–2.
 * Top half attacks down; bottom half attacks up.
 */
export function DualTeamPitchView({
  teamTop,
  teamBottom,
  playersTop,
  playersBottom,
  isMobile,
  isAdmin,
  onPlayerClick,
  currentUserId = null,
}: DualTeamPitchViewProps) {
  // IFAB vertical pitch: width/length = 68/105 (goals top & bottom).
  // Must match PitchMarkings viewBox or lines stretch incorrectly.
  const aspectRatio = `${68 / 105}`

  return (
    <div
      className="relative w-full animate-in fade-in-0 duration-300"
      style={{ aspectRatio }}
    >
      <div className="relative h-full w-full overflow-visible">
        <PitchSurface />
        {playersTop.map(({ user, position }) => (
          <PlayerMarker
            key={`top-${user.uid}`}
            user={user}
            position={position}
            team={teamTop}
            isMobile={isMobile}
            isAdmin={isAdmin}
            onPlayerClick={onPlayerClick}
            isCurrentUser={currentUserId === user.uid}
          />
        ))}
        {playersBottom.map(({ user, position }) => (
          <PlayerMarker
            key={`bottom-${user.uid}`}
            user={user}
            position={position}
            team={teamBottom}
            isMobile={isMobile}
            isAdmin={isAdmin}
            onPlayerClick={onPlayerClick}
            isCurrentUser={currentUserId === user.uid}
          />
        ))}
      </div>
    </div>
  )
}
