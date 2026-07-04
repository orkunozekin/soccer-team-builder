'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { DroppableTeamCard } from './DroppableTeamCard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cancelRSVPAPI, transferPlayerAPI } from '@/lib/api/client'
import { RSVP } from '@/types/rsvp'
import { Team } from '@/types/team'
import { User } from '@/types/user'

type DragData = { playerId: string; fromTeamId: string }

interface TeamsDisplayProps {
  matchId?: string
  teams: Team[]
  users: User[]
  isAdmin?: boolean
  onTeamsChanged?: () => void
  headerActions?: React.ReactNode
  /** When set, the current user's row is highlighted on team cards */
  currentUserId?: string | null
  /** When set (and isAdmin), admins can cancel a player's RSVP from the team card menu */
  matchRSVPs?: RSVP[]
}

export function TeamsDisplay({
  matchId,
  teams,
  users,
  isAdmin = false,
  onTeamsChanged,
  headerActions,
  currentUserId,
  matchRSVPs = [],
}: TeamsDisplayProps) {
  const dndEnabled = Boolean(isAdmin && matchId && onTeamsChanged)
  const [pageIndex, setPageIndex] = useState(0)
  const [transferError, setTransferError] = useState('')
  const [transferring, setTransferring] = useState<string | null>(null)
  const [pendingCancel, setPendingCancel] = useState<{
    userId: string
    displayName: string
  } | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const onRequestCancelRSVP = useCallback(
    (userId: string, displayName: string) => {
      setPendingCancel({ userId, displayName })
    },
    []
  )

  const handleConfirmCancelRSVP = useCallback(async () => {
    if (!pendingCancel) return
    const rsvp = matchRSVPs.find(
      r => r.userId === pendingCancel.userId && r.status === 'confirmed'
    )
    if (!rsvp) {
      setPendingCancel(null)
      return
    }
    setCancelling(true)
    try {
      await cancelRSVPAPI(rsvp.id)
      setPendingCancel(null)
      onTeamsChanged?.()
    } catch {
      setTransferError('Failed to cancel RSVP')
    } finally {
      setCancelling(false)
    }
  }, [pendingCancel, matchRSVPs, onTeamsChanged])

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
        teamStart === teamEnd
          ? `Team ${teamStart}`
          : `Teams ${teamStart}–${teamEnd}`
      out.push({ start, end, label })
    }
    return out
  }, [teamsSorted])

  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1))
  const page = pages[safePageIndex]
  const visibleTeams = page
    ? teamsSorted.slice(page.start, page.end)
    : teamsSorted.slice(0, 2)

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
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {visibleTeams.map(team => {
        const teamUsers = team.playerIds
          .map(userId => users.find(u => u.uid === userId))
          .filter((u): u is User => !!u)

        return (
          <div key={team.id} className="min-w-0">
            <DroppableTeamCard
              team={team}
              teamUsers={teamUsers}
              dndEnabled={dndEnabled}
              transferring={transferring}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onCancelRSVP={
                isAdmin && matchRSVPs.length > 0
                  ? onRequestCancelRSVP
                  : undefined
              }
            />
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-w-0 space-y-2 overflow-hidden">
      <AlertDialog
        open={!!pendingCancel}
        onOpenChange={open => !open && setPendingCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel RSVP?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCancel ? (
                <>
                  Cancel RSVP for{' '}
                  <strong>{pendingCancel.displayName || 'this player'}</strong>?
                  They will be removed from the team.
                </>
              ) : (
                'They will be removed from the team.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Keep RSVP
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleConfirmCancelRSVP()
              }}
              disabled={cancelling}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-600"
            >
              {cancelling ? 'Cancelling…' : 'Cancel RSVP'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-2xl font-bold">Teams</h2>
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
