'use client'

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { transferPlayerAPI } from '@/lib/api/client'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
import { cn } from '@/lib/utils'
import { Team } from '@/types/team'
import { User } from '@/types/user'

interface TeamsDisplayProps {
  matchId?: string
  teams: Team[]
  users: User[]
  isAdmin?: boolean
  onTeamsChanged?: () => void
  headerActions?: React.ReactNode
  /** When set, the current user's row is highlighted on team cards */
  currentUserId?: string | null
}

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
      {...(dndEnabled ? { ...listeners, ...attributes } : {})}
      className={cn(
        'flex items-center gap-2 text-sm rounded-md px-2 py-1.5 -mx-1',
        dndEnabled &&
          'touch-none hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        transferring === user.uid && 'opacity-50',
        isCurrentUser &&
          'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/40 dark:ring-primary/50 font-medium'
      )}
    >
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

function DroppableTeamCard({
  team,
  teamUsers,
  users,
  dndEnabled,
  transferring,
  currentUserId,
}: {
  team: Team
  teamUsers: User[]
  users: User[]
  dndEnabled: boolean
  transferring: string | null
  currentUserId?: string | null
}) {
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
            Drag players here to move teams. Works with touch on mobile.
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

export function TeamsDisplay({
  matchId,
  teams,
  users,
  isAdmin = false,
  onTeamsChanged,
  headerActions,
  currentUserId,
}: TeamsDisplayProps) {
  const dndEnabled = Boolean(isAdmin && matchId && onTeamsChanged)
  const [pageIndex, setPageIndex] = useState(0)
  const [transferError, setTransferError] = useState('')
  const [transferring, setTransferring] = useState<string | null>(null)

  const teamsSorted = useMemo(() => {
    return [...teams].sort((a, b) => (a.teamNumber ?? 0) - (b.teamNumber ?? 0))
  }, [teams])

  const pages = useMemo(() => {
    const out: { start: number; end: number; label: string }[] = []
    for (let start = 0; start < teamsSorted.length; start += 2) {
      const end = Math.min(teamsSorted.length, start + 2)
      const teamStart = start + 1
      const teamEnd = end
      const label =
        teamStart === teamEnd ? `Team ${teamStart}` : `Teams ${teamStart}–${teamEnd}`
      out.push({ start, end, label })
    }
    return out
  }, [teamsSorted])

  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1))
  const page = pages[safePageIndex]
  const visibleTeams = page ? teamsSorted.slice(page.start, page.end) : teamsSorted.slice(0, 2)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!dndEnabled || !matchId || !over || over.id === active.id) return

    const data = active.data.current as DragData | undefined
    if (!data?.playerId || !data?.fromTeamId) return

    const targetTeamId = String(over.id)
    if (data.fromTeamId === targetTeamId) return

    setTransferError('')
    setTransferring(data.playerId)
    try {
      await transferPlayerAPI(
        matchId,
        data.playerId,
        targetTeamId,
        data.fromTeamId,
        false
      )
      onTeamsChanged?.()
    } catch {
      setTransferError('Failed to transfer player')
    } finally {
      setTransferring(null)
    }
  }

  const content = (
    <div className="grid gap-4 sm:grid-cols-2">
      {visibleTeams.map((team) => {
        const teamUsers = team.playerIds
          .map((userId) => users.find((u) => u.uid === userId))
          .filter((u): u is User => !!u)

        return (
          <DroppableTeamCard
            key={team.id}
            team={team}
            teamUsers={teamUsers}
            users={users}
            dndEnabled={dndEnabled}
            transferring={transferring}
            currentUserId={currentUserId}
          />
        )
      })}
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Teams</h2>
        {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
      </div>

      {pages.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pages.map((p, i) => (
            <Button
              key={`${p.start}-${p.end}`}
              size="sm"
              className="h-9"
              variant={i === safePageIndex ? 'default' : 'outline'}
              onClick={() => setPageIndex(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      )}

      {transferError && (
        <div className="rounded-md border border-red-300 bg-red-100 p-3 text-sm font-medium text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {transferError}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {content}
      </DndContext>
    </div>
  )
}
