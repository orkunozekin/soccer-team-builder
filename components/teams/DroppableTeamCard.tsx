'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  CheckCircle2,
  CircleDashed,
  GripVertical,
  MoreVertical,
  XCircle,
} from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { AttendanceLabel } from '@/lib/utils/checkIn'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Team } from '@/types/team'
import { User } from '@/types/user'

type DragData = { playerId: string; fromTeamId: string }

export function CheckInStatusIcon({
  label,
  className,
}: {
  label: AttendanceLabel
  className?: string
}) {
  const statusText = label === 'Pending' ? 'Pending check-in' : label
  const icon =
    label === 'Present' ? (
      <CheckCircle2
        className={cn('h-4 w-4 shrink-0 text-emerald-600', className)}
        aria-hidden
      />
    ) : label === 'No-show' ? (
      <XCircle
        className={cn('h-4 w-4 shrink-0 text-red-600', className)}
        aria-hidden
      />
    ) : (
      <CircleDashed
        className={cn('h-4 w-4 shrink-0 text-amber-500', className)}
        aria-hidden
      />
    )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label={statusText}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-auto px-3 py-1.5 text-sm font-medium"
      >
        {statusText}
      </PopoverContent>
    </Popover>
  )
}

/** Presentational player row used in team lists and the drag overlay. */
export function PlayerTile({
  user,
  teamColor,
  showGrip = false,
  gripProps,
  isCurrentUser = false,
  isAdmin = false,
  onCancelRSVP,
  attendanceLabel,
  onHostCheckIn,
  className,
}: {
  user: User
  teamColor?: string | null
  showGrip?: boolean
  gripProps?: HTMLAttributes<HTMLSpanElement>
  isCurrentUser?: boolean
  isAdmin?: boolean
  onCancelRSVP?: (userId: string, displayName: string) => void
  /** When set, shows a colored check-in status icon at the trailing edge. */
  attendanceLabel?: AttendanceLabel | null
  /** Admin host override: mark present / clear check-in */
  onHostCheckIn?: (userId: string, attended: boolean) => void
  className?: string
}) {
  const displayName = user.displayName || user.email || ''
  const showMenu = Boolean(
    isAdmin && (onCancelRSVP || (onHostCheckIn && attendanceLabel))
  )
  const isPresent = attendanceLabel === 'Present'

  return (
    <div
      className={cn(
        '-mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm sm:gap-2 sm:px-2',
        isCurrentUser &&
          'bg-primary/10 font-medium ring-1 ring-primary/40 dark:bg-primary/20 dark:ring-primary/50',
        className
      )}
    >
      {showGrip && (
        <span
          {...gripProps}
          className="flex shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:text-zinc-500 dark:hover:text-zinc-300"
          title="Drag to move to another team"
          aria-label="Drag to move player to another team"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: teamColor || '#3b82f6' }}
      >
        {user.jerseyNumber != null ? user.jerseyNumber : ''}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate leading-tight" title={displayName}>
          {displayName}
        </p>
        {user.position ? (
          <p
            className={cn(
              'truncate text-xs leading-tight text-zinc-500 dark:text-zinc-400',
              isGoalkeeper(user.position) &&
                'font-medium text-amber-700 dark:text-amber-400'
            )}
          >
            {user.position}
          </p>
        ) : null}
      </div>
      {(attendanceLabel || showMenu) && (
        <div className="flex shrink-0 items-center gap-0.5">
          {attendanceLabel ? (
            <CheckInStatusIcon label={attendanceLabel} />
          ) : null}
          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Player actions"
                  onClick={e => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onHostCheckIn && attendanceLabel ? (
                  <DropdownMenuItem
                    onClick={() => onHostCheckIn(user.uid, !isPresent)}
                  >
                    {isPresent ? 'Clear check-in' : 'Mark present'}
                  </DropdownMenuItem>
                ) : null}
                {onCancelRSVP ? (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                    onClick={() => onCancelRSVP(user.uid, displayName)}
                  >
                    Cancel RSVP
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}
    </div>
  )
}

function DraggablePlayerRow({
  user,
  team,
  dndEnabled,
  transferring,
  isCurrentUser,
  isAdmin,
  onCancelRSVP,
  attendanceLabel,
  onHostCheckIn,
}: {
  user: User
  team: Team
  dndEnabled: boolean
  transferring: string | null
  isCurrentUser: boolean
  isAdmin: boolean
  onCancelRSVP?: (userId: string, displayName: string) => void
  attendanceLabel?: AttendanceLabel | null
  onHostCheckIn?: (userId: string, attended: boolean) => void
}) {
  const id = `player:${user.uid}:${team.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { playerId: user.uid, fromTeamId: team.id } satisfies DragData,
    disabled: !dndEnabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        dndEnabled && 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
        (isDragging || transferring === user.uid) && 'opacity-40'
      )}
    >
      <PlayerTile
        user={user}
        teamColor={team.color}
        showGrip={dndEnabled}
        gripProps={{ ...listeners, ...attributes }}
        isCurrentUser={isCurrentUser}
        isAdmin={isAdmin}
        onCancelRSVP={onCancelRSVP}
        attendanceLabel={attendanceLabel}
        onHostCheckIn={onHostCheckIn}
      />
    </div>
  )
}

export interface DroppableTeamCardProps {
  team: Team
  teamUsers: User[]
  dndEnabled: boolean
  transferring: string | null
  currentUserId?: string | null
  isAdmin?: boolean
  onCancelRSVP?: (userId: string, displayName: string) => void
  onHostCheckIn?: (userId: string, attended: boolean) => void
  /** userId → check-in status; omit/empty to hide icons */
  attendanceByUserId?: Map<string, AttendanceLabel>
}

export function DroppableTeamCard({
  team,
  teamUsers,
  dndEnabled,
  transferring,
  currentUserId,
  isAdmin = false,
  onCancelRSVP,
  onHostCheckIn,
  attendanceByUserId,
}: DroppableTeamCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: team.id,
    disabled: !dndEnabled,
  })

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'min-w-0 overflow-hidden',
        dndEnabled &&
          'outline outline-1 outline-transparent hover:outline-zinc-300',
        isOver &&
          dndEnabled &&
          'outline-2 outline-zinc-400 ring-2 ring-zinc-300 dark:ring-zinc-600'
      )}
    >
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle className="min-w-0">
            {team.name || `Team ${team.teamNumber}`}
          </CardTitle>
          <Badge
            style={{ backgroundColor: team.color || '#3b82f6' }}
            className="shrink-0 text-white"
          >
            {team.playerIds.length}/{team.maxSize}
          </Badge>
        </div>
        {dndEnabled && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Use the grip handle (⋮⋮) on a player to drag them to another team.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teamUsers.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No players assigned
            </p>
          ) : (
            teamUsers.map(user => (
              <DraggablePlayerRow
                key={user.uid}
                user={user}
                team={team}
                dndEnabled={dndEnabled}
                transferring={transferring}
                isCurrentUser={
                  currentUserId != null && user.uid === currentUserId
                }
                isAdmin={isAdmin}
                onCancelRSVP={onCancelRSVP}
                onHostCheckIn={onHostCheckIn}
                attendanceLabel={attendanceByUserId?.get(user.uid) ?? null}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
