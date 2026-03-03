'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { Team } from '@/types/team'
import { User } from '@/types/user'

type DragData = { playerId: string; fromTeamId: string }

function DraggablePlayerRow({
  user,
  team,
  dndEnabled,
  transferring,
  isCurrentUser,
  isAdmin,
  onCancelRSVP,
}: {
  user: User
  team: Team
  dndEnabled: boolean
  transferring: string | null
  isCurrentUser: boolean
  isAdmin: boolean
  onCancelRSVP?: (userId: string, displayName: string) => void
}) {
  const id = `player:${user.uid}:${team.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { playerId: user.uid, fromTeamId: team.id } satisfies DragData,
    disabled: !dndEnabled,
  })
  const displayName = user.displayName || user.email || ''

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-0 items-center gap-2 text-sm rounded-md px-2 py-1.5 -mx-1',
        dndEnabled && 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
        isDragging && 'opacity-50',
        transferring === user.uid && 'opacity-50',
        isCurrentUser &&
          'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/40 dark:ring-primary/50 font-medium'
      )}
    >
      {dndEnabled && (
        <span
          {...listeners}
          {...attributes}
          className="flex shrink-0 touch-none cursor-grab active:cursor-grabbing rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          title="Drag to move to another team"
          aria-label="Drag to move player to another team"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: team.color || '#3b82f6' }}
      >
        {user.jerseyNumber != null ? user.jerseyNumber : ''}
      </span>
      <span
        className="flex-1 min-w-0 truncate"
        title={displayName}
      >
        {displayName}
      </span>
      {user.position && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 text-xs',
            isGoalkeeper(user.position) &&
              'bg-amber-200/90 dark:bg-amber-700/50 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100'
          )}
        >
          {user.position}
        </Badge>
      )}
      {isAdmin && onCancelRSVP && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Player actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              onClick={() => onCancelRSVP(user.uid, displayName)}
            >
              Cancel RSVP
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
}

export function DroppableTeamCard({
  team,
  teamUsers,
  dndEnabled,
  transferring,
  currentUserId,
  isAdmin = false,
  onCancelRSVP,
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
        dndEnabled && 'outline outline-1 outline-transparent hover:outline-zinc-300',
        isOver && dndEnabled && 'outline-2 outline-zinc-400 ring-2 ring-zinc-300 dark:ring-zinc-600'
      )}
    >
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle className="min-w-0 truncate">{team.name || `Team ${team.teamNumber}`}</CardTitle>
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
            teamUsers.map((user) => (
              <DraggablePlayerRow
                key={user.uid}
                user={user}
                team={team}
                dndEnabled={dndEnabled}
                transferring={transferring}
                isCurrentUser={currentUserId != null && user.uid === currentUserId}
                isAdmin={isAdmin}
                onCancelRSVP={onCancelRSVP}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
