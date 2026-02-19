'use client'

import { useMemo, useState } from 'react'
import { User } from '@/types/user'
import { Team } from '@/types/team'
import { transferPlayerAPI } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TeamsDisplayProps {
  matchId?: string
  teams: Team[]
  users: User[]
  benchPlayerIds: string[]
  isAdmin?: boolean
  onTeamsChanged?: () => void
}

export function TeamsDisplay({
  matchId,
  teams,
  users,
  benchPlayerIds,
  isAdmin = false,
  onTeamsChanged,
}: TeamsDisplayProps) {
  const dndEnabled = Boolean(isAdmin && matchId && onTeamsChanged)
  const [pageIndex, setPageIndex] = useState(0)
  const [transferError, setTransferError] = useState('')
  const [transferring, setTransferring] = useState<string | null>(null)

  const teamsSorted = useMemo(() => {
    return [...teams].sort((a, b) => (a.teamNumber ?? 0) - (b.teamNumber ?? 0))
  }, [teams])

  const pages = useMemo(() => {
    const out: { start: number; end: number; label: string; kind: 'main' | 'extra' }[] = []
    for (let start = 0; start < teamsSorted.length; start += 2) {
      const end = Math.min(teamsSorted.length, start + 2)
      const kind = start === 0 ? 'main' : 'extra'
      const teamStart = start + 1
      const teamEnd = end
      const label =
        kind === 'main'
          ? `Main (Teams ${teamStart}–${teamEnd})`
          : `Extra (Teams ${teamStart}–${teamEnd})`
      out.push({ start, end, label, kind })
    }
    return out
  }, [teamsSorted])

  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1))
  const page = pages[safePageIndex]
  const visibleTeams = page ? teamsSorted.slice(page.start, page.end) : teamsSorted.slice(0, 2)

  type DragPayload = { playerId: string; fromTeamId?: string; fromBench?: boolean }
  const parsePayload = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return null
    try {
      return JSON.parse(raw) as DragPayload
    } catch {
      return null
    }
  }

  const onDropToTeam = async (e: React.DragEvent, targetTeamId: string) => {
    if (!dndEnabled || !matchId) return
    e.preventDefault()
    const payload = parsePayload(e)
    if (!payload?.playerId) return
    if (payload.fromTeamId === targetTeamId) return

    setTransferError('')
    setTransferring(payload.playerId)
    try {
      await transferPlayerAPI(
        matchId,
        payload.playerId,
        targetTeamId,
        payload.fromTeamId,
        payload.fromBench
      )
      onTeamsChanged?.()
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Failed to transfer player')
    } finally {
      setTransferring(null)
    }
  }

  const onDropToBench = async (e: React.DragEvent) => {
    if (!dndEnabled || !matchId) return
    e.preventDefault()
    const payload = parsePayload(e)
    if (!payload?.playerId) return
    if (payload.fromBench) return

    setTransferError('')
    setTransferring(payload.playerId)
    try {
      await transferPlayerAPI(
        matchId,
        payload.playerId,
        'bench',
        payload.fromTeamId,
        payload.fromBench
      )
      onTeamsChanged?.()
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Failed to transfer player')
    } finally {
      setTransferring(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Teams</h2>
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

      {page && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">
            {page.kind === 'main' ? 'Main teams' : 'Extra teams'}
          </span>{' '}
          — showing {page.start + 1}–{page.end} of {teamsSorted.length}
        </div>
      )}

      {transferError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {transferError}
        </div>
      )}

      {/* Pitch view temporarily disabled. List-only, 2 teams at a time. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleTeams.map((team) => {
          const teamUsers = team.playerIds
            .map((userId) => users.find((u) => u.uid === userId))
            .filter((u): u is User => !!u)

          return (
            <Card
              key={team.id}
              onDragOver={(e) => dndEnabled && e.preventDefault()}
              onDrop={(e) => onDropToTeam(e, team.id)}
              className={cn(dndEnabled && 'outline outline-1 outline-transparent hover:outline-zinc-300')}
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
                    Drag players here to move teams.
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
                      <div
                        key={user.uid}
                        draggable={dndEnabled}
                        onDragStart={(e) => {
                          if (!dndEnabled) return
                          const payload = { playerId: user.uid, fromTeamId: team.id } satisfies DragPayload
                          e.dataTransfer.setData('application/json', JSON.stringify(payload))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        className={cn(
                          'flex items-center gap-2 text-sm',
                          dndEnabled && 'rounded-md px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-grab active:cursor-grabbing',
                          transferring === user.uid && 'opacity-50'
                        )}
                      >
                        <span
                          className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
                          style={{ backgroundColor: team.color || '#3b82f6' }}
                        >
                          {user.jerseyNumber || '?'}
                        </span>
                        <span className="truncate">{user.displayName}</span>
                        {user.position && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            {user.position}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {(benchPlayerIds.length > 0 || dndEnabled) && (
        <Card
          onDragOver={(e) => dndEnabled && e.preventDefault()}
          onDrop={onDropToBench}
          className={cn(dndEnabled && 'outline outline-1 outline-transparent hover:outline-zinc-300')}
        >
          <CardHeader>
            <CardTitle>Bench</CardTitle>
            {dndEnabled && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Drag players here to bench them.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {benchPlayerIds.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No players on bench
                </p>
              ) : (
                benchPlayerIds
                  .map((id) => users.find((u) => u.uid === id))
                  .filter((u): u is User => !!u)
                  .map((user) => (
                    <div
                      key={user.uid}
                      draggable={dndEnabled}
                      onDragStart={(e) => {
                        if (!dndEnabled) return
                        const payload = { playerId: user.uid, fromBench: true } satisfies DragPayload
                        e.dataTransfer.setData('application/json', JSON.stringify(payload))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        dndEnabled && 'rounded-md px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-grab active:cursor-grabbing',
                        transferring === user.uid && 'opacity-50'
                      )}
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-500 text-white text-xs font-bold">
                        {user.jerseyNumber || '?'}
                      </span>
                      <span className="truncate">{user.displayName}</span>
                      {user.position && (
                        <span className="ml-auto text-xs text-zinc-600 dark:text-zinc-400">
                          {user.position}
                        </span>
                      )}
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
