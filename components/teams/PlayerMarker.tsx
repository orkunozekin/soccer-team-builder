'use client'

import { User } from '@/types/user'
import { Team } from '@/types/team'
import { PitchPosition } from '@/lib/utils/pitchLayout'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { formatPitchDisplayName } from '@/lib/utils/displayName'

interface PlayerMarkerProps {
  user: User
  position: PitchPosition
  team: Team
  isMobile: boolean
  isAdmin: boolean
  onPlayerClick?: (userId: string, teamId: string | null) => void
  /** Counter-flip the icon/label so text reads correctly on a flipped pitch */
  counterFlipX?: boolean
  counterFlipY?: boolean
}

export function PlayerMarker({
  user,
  position,
  team,
  isMobile,
  isAdmin,
  onPlayerClick,
  counterFlipX = false,
  counterFlipY = false,
}: PlayerMarkerProps) {
  const isGK = isGoalkeeper(user.position)
  const clickable = isAdmin && onPlayerClick

  const content = (
    <>
      <div
        className="flex flex-col items-center justify-center rounded-full border-2 border-white shadow-md"
        style={{
          width: isMobile ? 28 : 44,
          height: isMobile ? 28 : 44,
          minWidth: isMobile ? 28 : 44,
          minHeight: isMobile ? 28 : 44,
          backgroundColor: isGK ? '#eab308' : (team.color || '#1e40af'),
        }}
      >
        <span
          className={`font-bold leading-none tabular-nums drop-shadow-sm ${
            isGK ? 'text-zinc-900' : 'text-white'
          } ${isMobile ? 'text-[10px]' : 'text-sm'}`}
        >
          {user.jerseyNumber ?? '?'}
        </span>
      </div>
      <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-px text-center flex flex-col items-center gap-px ${isMobile ? 'w-[3rem]' : 'w-[4.5rem]'}`}>
        <span
          className={`font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap truncate block leading-tight ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}
          title={user.displayName}
        >
          {formatPitchDisplayName(user.displayName, isMobile ? 10 : 14)}
        </span>
        {user.position && (
          <span className={`text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-tight ${isMobile ? 'text-[7px]' : 'text-[9px]'}`}>
            {user.position}
          </span>
        )}
      </div>
    </>
  )

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 transition-transform ${
        clickable ? 'cursor-pointer hover:scale-110' : ''
      }`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onClick={() => clickable && onPlayerClick(user.uid, team.id)}
    >
      {counterFlipX || counterFlipY ? (
        <div
          className="inline-block"
          style={{
            transform: `scaleX(${counterFlipX ? -1 : 1}) scaleY(${counterFlipY ? -1 : 1})`,
          }}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  )
}
