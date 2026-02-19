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
  flip?: boolean
}

export function SinglePitchView({
  team,
  players,
  isMobile,
  isAdmin,
  onPlayerClick,
  flip = false,
}: SinglePitchViewProps) {
  return (
    <div
      className={`relative w-full ${flip ? 'scale-x-[-1]' : ''}`}
      style={{ aspectRatio: '105/68' }}
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
            counterFlip={flip}
          />
        ))}
      </div>
    </div>
  )
}
