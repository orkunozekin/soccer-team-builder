'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
}: {
  user: User
  team: Team
  dndEnabled: boolean
  transferring: string | null
  isCurrentUser: boolean
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
        'flex items-center gap-2 text-sm rounded-md px-2 py-1.5 -mx-1',
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
      <span className="truncate">{user.displayName}</span>
      {user.position && (
        <Badge
          variant="outline"
          className={cn(
            'ml-auto text-xs',
            isGoalkeeper(user.position) &&
              'bg-amber-200/90 dark:bg-amber-700/50 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100'
          )}
        >
          {user.position}
        </Badge>
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
}

export function DroppableTeamCard({
  team,
  teamUsers,
  dndEnabled,
  transferring,
  currentUserId,
}: DroppableTeamCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: team.id,
    disabled: !dndEnabled,
  })

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        dndEnabled && 'outline outline-1 outline-transparent hover:outline-zinc-300',
        isOver && dndEnabled && 'outline-2 outline-zinc-400 ring-2 ring-zinc-300 dark:ring-zinc-600'
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{team.name || `Team ${team.teamNumber}`}</CardTitle>
          <Badge
            style={{ backgroundColor: team.color || '#3b82f6' }}
            className="text-white"
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
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
