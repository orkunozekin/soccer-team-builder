'use client'

import { formatPitchDisplayName } from '@/lib/utils/displayName'
import {
  formatJerseyDisplay,
  formatPositionDisplay,
} from '@/lib/utils/jerseyNumber'
import { PitchPosition } from '@/lib/utils/pitchLayout'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Team } from '@/types/team'
import { User } from '@/types/user'

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
  isCurrentUser?: boolean
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
  isCurrentUser = false,
}: PlayerMarkerProps) {
  const isGK = isGoalkeeper(user.position)
  const clickable = isAdmin && onPlayerClick
  const size = isMobile ? 28 : 36

  const content = (
    <>
      <div
        className={`relative flex items-center justify-center rounded-full border shadow-sm ${
          isCurrentUser
            ? 'animate-headcount-bump border-red-50 ring-2 ring-red-50/50'
            : 'border-white/90'
        }`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          backgroundColor: isGK ? '#f5d76e' : team.color || '#1e40af',
        }}
      >
        {/* Silhouette ring — denser pro-lineup look without requiring photos */}
        <span
          className="pointer-events-none absolute inset-[2px] rounded-full bg-black/10"
          aria-hidden
        />
        <span
          className={`relative z-[1] font-bold tabular-nums leading-none drop-shadow-sm ${
            isGK ? 'text-zinc-900' : 'text-white'
          } ${isMobile ? 'text-[11px]' : 'text-sm'}`}
        >
          {formatJerseyDisplay(user.jerseyNumber)}
        </span>
      </div>
      <div
        className={`absolute left-1/2 top-full mt-0.5 flex -translate-x-1/2 flex-col items-center gap-0.5 text-center ${
          isMobile ? 'w-[5rem]' : 'w-[6.5rem]'
        }`}
      >
        <span
          className={`block truncate whitespace-nowrap font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}
          title={user.displayName}
        >
          {formatPitchDisplayName(user.displayName, isMobile ? 12 : 16)}
        </span>
        {user.position && (
          <span
            className={`font-medium leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
              isMobile ? 'text-[10px]' : 'text-xs'
            }`}
          >
            {formatPositionDisplay(user.position)}
          </span>
        )}
      </div>
    </>
  )

  return (
    <div
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 transform transition-transform duration-200 ease-out ${
        clickable ? 'cursor-pointer hover:z-20 hover:scale-110' : ''
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
