'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { DroppableTeamCard, PlayerTile, CheckInStatusLegend } from './DroppableTeamCard'
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
import { cancelRSVPAPI, hostCheckInAllAPI, hostCheckInAPI, transferPlayerAPI } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import {
  getAttendanceLabel,
  hasCheckInWindowStarted,
  isCheckInWindowEnded,
  type AttendanceLabel,
} from '@/lib/utils/checkIn'
import { RSVP } from '@/types/rsvp'
import { Team } from '@/types/team'
import { User } from '@/types/user'
import { useMatchStore } from '@/store/matchStore'

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
  /** Match kickoff date/time — used to show check-in icons once the window starts */
  matchDate?: Date | null
  matchTime?: string | null
  /** When false, hide admin cancel-RSVP actions (e.g. after kickoff) */
  allowCancelRsvp?: boolean
}

function movePlayerBetweenTeams(
  teams: Team[],
  playerId: string,
  fromTeamId: string,
  toTeamId: string
): Team[] {
  return teams.map(team => {
    if (team.id === fromTeamId) {
      return {
        ...team,
        playerIds: team.playerIds.filter(id => id !== playerId),
      }
    }
    if (team.id === toTeamId) {
      if (team.playerIds.includes(playerId)) return team
      return {
        ...team,
        playerIds: [...team.playerIds, playerId],
      }
    }
    return team
  })
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
  matchDate = null,
  matchTime = null,
  allowCancelRsvp = true,
}: TeamsDisplayProps) {
  const dndEnabled = Boolean(isAdmin && matchId && onTeamsChanged)
  const { updateRSVPAttendance, bulkUpdateRSVPAttendance } = useMatchStore()
  const [pageIndex, setPageIndex] = useState(0)
  const [transferError, setTransferError] = useState('')
  const [transferring, setTransferring] = useState<string | null>(null)
  const [hostCheckInBusy, setHostCheckInBusy] = useState<string | null>(null)
  const [markAllPresentBusy, setMarkAllPresentBusy] = useState(false)
  const [activeDrag, setActiveDrag] = useState<{
    user: User
    teamColor: string | null
    attendanceLabel: AttendanceLabel | null
  } | null>(null)
  const [localTeams, setLocalTeams] = useState(teams)
  const [pendingCancel, setPendingCancel] = useState<{
    userId: string
    displayName: string
  } | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    setLocalTeams(teams)
  }, [teams])

  const attendanceByUserId = useMemo(() => {
    const map = new Map<string, AttendanceLabel>()
    if (!matchDate || !hasCheckInWindowStarted(matchDate, matchTime)) {
      return map
    }
    const windowEnded = isCheckInWindowEnded(matchDate, matchTime)
    for (const rsvp of matchRSVPs) {
      if (rsvp.status !== 'confirmed') continue
      map.set(rsvp.userId, getAttendanceLabel(rsvp, windowEnded))
    }
    return map
  }, [matchDate, matchTime, matchRSVPs])

  const unmarkedConfirmedCount = useMemo(
    () =>
      matchRSVPs.filter(r => r.status === 'confirmed' && r.attended !== true)
        .length,
    [matchRSVPs]
  )

  const showMarkAllPresent =
    isAdmin && Boolean(matchId) && unmarkedConfirmedCount > 0

  const handleHostCheckIn = useCallback(
    async (userId: string, attended: boolean) => {
      if (!matchId || hostCheckInBusy) return
      setHostCheckInBusy(userId)
      setTransferError('')
      try {
        const res = await hostCheckInAPI(matchId, userId, attended)
        updateRSVPAttendance(res.rsvpId, {
          attended: attended ? true : null,
          checkedInAt: attended ? new Date() : null,
          checkInMethod: attended ? 'host' : null,
        })
        onTeamsChanged?.()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update check-in'
        setTransferError(message)
      } finally {
        setHostCheckInBusy(null)
      }
    },
    [matchId, hostCheckInBusy, updateRSVPAttendance, onTeamsChanged]
  )

  const handleMarkAllPresent = useCallback(async () => {
    if (!matchId || markAllPresentBusy) return
    setMarkAllPresentBusy(true)
    setTransferError('')
    try {
      const res = await hostCheckInAllAPI(matchId)
      const now = new Date()
      bulkUpdateRSVPAttendance(
        res.updated.map(item => ({
          rsvpId: item.rsvpId,
          attended: true,
          checkedInAt: now,
          checkInMethod: 'host',
        }))
      )
      onTeamsChanged?.()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to mark everyone present'
      setTransferError(message)
    } finally {
      setMarkAllPresentBusy(false)
    }
  }, [matchId, markAllPresentBusy, bulkUpdateRSVPAttendance, onTeamsChanged])

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
    return [...localTeams].sort(
      (a, b) => (a.teamNumber ?? 0) - (b.teamNumber ?? 0)
    )
  }, [localTeams])

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

  const usersById = useMemo(() => {
    const map = new Map(users.map(u => [u.uid, u]))
    return map
  }, [users])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    if (!data?.playerId) {
      setActiveDrag(null)
      return
    }
    const user = usersById.get(data.playerId)
    const fromTeam = localTeams.find(t => t.id === data.fromTeamId)
    if (!user) {
      setActiveDrag(null)
      return
    }
    setActiveDrag({
      user,
      teamColor: fromTeam?.color ?? null,
      attendanceLabel: attendanceByUserId.get(data.playerId) ?? null,
    })
  }

  const handleDragCancel = () => {
    setActiveDrag(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!dndEnabled || !matchId || !over || over.id === active.id) return

    const data = active.data.current as DragData | undefined
    if (!data?.playerId || !data?.fromTeamId) return

    const targetTeamId = String(over.id)
    if (data.fromTeamId === targetTeamId) return

    const previousTeams = localTeams
    const nextTeams = movePlayerBetweenTeams(
      localTeams,
      data.playerId,
      data.fromTeamId,
      targetTeamId
    )
    setLocalTeams(nextTeams)
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
      setLocalTeams(previousTeams)
      setTransferError('Failed to transfer player')
    } finally {
      setTransferring(null)
    }
  }

  const content = (
    <div
      className={cn(
        'grid min-w-0 gap-4',
        visibleTeams.length > 1 && 'sm:grid-cols-2'
      )}
    >
      {visibleTeams.map(team => {
        const teamUsers = team.playerIds
          .map(userId => usersById.get(userId))
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
              attendanceByUserId={attendanceByUserId}
              onHostCheckIn={
                isAdmin && attendanceByUserId.size > 0
                  ? handleHostCheckIn
                  : undefined
              }
              onCancelRSVP={
                isAdmin && allowCancelRsvp && matchRSVPs.length > 0
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showMarkAllPresent ? (
            <Button
              size="sm"
              variant="outline"
              disabled={markAllPresentBusy || hostCheckInBusy != null}
              onClick={handleMarkAllPresent}
            >
              {markAllPresentBusy
                ? 'Marking present…'
                : `Mark all present (${unmarkedConfirmedCount})`}
            </Button>
          ) : null}
          {headerActions ? headerActions : null}
        </div>
      </div>

      {attendanceByUserId.size > 0 ? <CheckInStatusLegend /> : null}

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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {content}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="min-w-[220px] rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
              <PlayerTile
                user={activeDrag.user}
                teamColor={activeDrag.teamColor}
                showGrip
                attendanceLabel={activeDrag.attendanceLabel}
                className="cursor-grabbing"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
