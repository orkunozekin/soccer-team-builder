'use client'

import { resolveTeamColor, teamTextColor } from '@/lib/constants/teamColors'
import { formatPitchDisplayName } from '@/lib/utils/displayName'
import { formatJerseyDisplay } from '@/lib/utils/jerseyNumber'
import { PitchPosition } from '@/lib/utils/pitchLayout'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Team } from '@/types/team'
import { User } from '@/types/user'

const GOALKEEPER_DISC_COLOR = '#f5d76e'

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
  const discColor = isGK ? GOALKEEPER_DISC_COLOR : resolveTeamColor(team.color)
  const clickable = isAdmin && onPlayerClick
  const size = isMobile ? 30 : 40

  const content = (
    <>
      <div
        className={`relative flex items-center justify-center rounded-full border shadow-sm ${
          isCurrentUser
            ? 'animate-headcount-bump border-ink ring-2 ring-chalk'
            : 'border-white/90'
        }`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          backgroundColor: discColor,
        }}
      >
        {/* Silhouette ring — denser pro-lineup look without requiring photos */}
        <span
          className="pointer-events-none absolute inset-[2px] rounded-full bg-black/10"
          aria-hidden
        />
        <span
          className={`relative z-[1] font-mono font-bold tabular-nums leading-none ${
            isMobile ? 'text-xs' : 'text-base'
          }`}
          style={{ color: teamTextColor(discColor) }}
        >
          {formatJerseyDisplay(user.jerseyNumber)}
        </span>
      </div>
      {/* Always below the disc — bottom GKs may overflow the pitch edge. */}
      <div
        className={`absolute left-1/2 top-full mt-0 flex -translate-x-1/2 flex-col items-center text-center ${
          isMobile ? 'w-[5.75rem]' : 'w-[7.5rem]'
        }`}
      >
        <span
          className={`block max-w-full whitespace-nowrap font-bold ${
            isGK
              ? // Solid black on a light pill — readable on grass. Avoid
                // leading-none + truncate which clips glyph descenders.
                'rounded-sm bg-white/90 px-1.5 py-0.5 leading-tight text-black shadow-sm'
              : 'truncate leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]'
          } ${isMobile ? 'text-[11px]' : 'text-xs'}`}
          title={user.displayName}
        >
          {formatPitchDisplayName(user.displayName, isMobile ? 14 : 18)}
        </span>
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
