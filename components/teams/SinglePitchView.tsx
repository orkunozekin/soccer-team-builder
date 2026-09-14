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
  /** Optional label overlay (e.g. team name on dual pitch halves). */
  label?: string
  labelSide?: 'top' | 'bottom'
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
  label,
  labelSide = 'top',
}: SinglePitchViewProps) {
  const scaleX = flipX ? -1 : 1
  const scaleY = flipY ? -1 : 1
  const pitchTransform =
    scaleX === 1 && scaleY === 1
      ? undefined
      : `scaleX(${scaleX}) scaleY(${scaleY})`

  // Mobile: slightly taller so markers remain readable.
  const aspectRatio = isMobile ? '4/3' : '105/68'

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
        {label ? (
          <div
            className={`pointer-events-none absolute left-2 z-20 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 ${
              labelSide === 'top' ? 'top-2' : 'bottom-2'
            }`}
            style={{ backgroundColor: `${team.color || '#1e40af'}cc` }}
          >
            {label}
          </div>
        ) : null}
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
