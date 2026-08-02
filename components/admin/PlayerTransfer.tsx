'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { transferPlayerAPI } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { Team } from '@/types/team'
import { User } from '@/types/user'

type TransferMode = 'move' | 'swap'

interface PlayerTransferProps {
  matchId: string
  teams: Team[]
  users: User[]
  onTransferComplete?: () => void
}

export function PlayerTransfer({
  matchId,
  teams,
  users,
  onTransferComplete,
}: PlayerTransferProps) {
  const [mode, setMode] = useState<TransferMode>('move')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [targetTeamId, setTargetTeamId] = useState<string>('')
  const [swapWithPlayerId, setSwapWithPlayerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allPlayerIds = new Set<string>()
  teams.forEach(team => team.playerIds.forEach(id => allPlayerIds.add(id)))

  const availablePlayers = users.filter(u => allPlayerIds.has(u.uid))
  const usersById = useMemo(
    () => new Map(users.map(u => [u.uid, u])),
    [users]
  )

  const teamColorByPlayerId = useMemo(() => {
    const map = new Map<string, string>()
    for (const team of teams) {
      const color = team.color || '#3b82f6'
      for (const id of team.playerIds) {
        if (!map.has(id)) map.set(id, color)
      }
    }
    return map
  }, [teams])

  const teamNameById = useMemo(
    () => new Map(teams.map(t => [t.id, t.name || `Team ${t.teamNumber}`])),
    [teams]
  )
  const teamColorById = useMemo(
    () => new Map(teams.map(t => [t.id, t.color || '#3b82f6'])),
    [teams]
  )

  const teamNameByPlayerId = useMemo(() => {
    const map = new Map<string, string>()
    for (const team of teams) {
      const name = team.name || `Team ${team.teamNumber}`
      for (const id of team.playerIds) {
        if (!map.has(id)) map.set(id, name)
      }
    }
    return map
  }, [teams])

  const selectedPlayerTeamId = useMemo(() => {
    if (!selectedPlayerId) return null
    for (const team of teams) {
      if (team.playerIds.includes(selectedPlayerId)) return team.id
    }
    return null
  }, [teams, selectedPlayerId])

  const destinationTeams = useMemo(() => {
    if (mode !== 'swap' || !selectedPlayerTeamId) return teams
    return teams.filter(t => t.id !== selectedPlayerTeamId)
  }, [mode, teams, selectedPlayerTeamId])

  const swapCandidates = useMemo(() => {
    if (!targetTeamId) return []
    const team = teams.find(t => t.id === targetTeamId)
    if (!team) return []
    return team.playerIds
      .filter(id => id !== selectedPlayerId)
      .map(id => usersById.get(id))
      .filter((u): u is User => !!u)
  }, [teams, targetTeamId, selectedPlayerId, usersById])

  const styleForTeamColor = (
    hex: string | null
  ): React.CSSProperties | undefined => {
    if (!hex) return undefined
    return {
      backgroundColor: hex,
      color: 'white',
    }
  }

  const resetForm = () => {
    setSelectedPlayerId('')
    setTargetTeamId('')
    setSwapWithPlayerId('')
  }

  const handleModeChange = (next: TransferMode) => {
    setMode(next)
    setError('')
    setSwapWithPlayerId('')
    if (
      next === 'swap' &&
      selectedPlayerTeamId &&
      targetTeamId === selectedPlayerTeamId
    ) {
      setTargetTeamId('')
    }
  }

  const handleTransfer = async () => {
    if (!selectedPlayerId || !targetTeamId) {
      setError('Please select both player and target team')
      return
    }
    if (mode === 'swap' && !swapWithPlayerId) {
      setError('Please select a player to swap with')
      return
    }

    setLoading(true)
    setError('')

    try {
      let currentTeam: Team | null = null
      for (const team of teams) {
        if (team.playerIds.includes(selectedPlayerId)) {
          currentTeam = team
          break
        }
      }

      await transferPlayerAPI(
        matchId,
        selectedPlayerId,
        targetTeamId,
        currentTeam?.id,
        false,
        mode === 'swap' ? swapWithPlayerId : undefined
      )

      resetForm()
      onTransferComplete?.()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'swap'
            ? 'Failed to swap players'
            : 'Failed to transfer player'
      )
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    Boolean(selectedPlayerId && targetTeamId) &&
    (mode === 'move' || Boolean(swapWithPlayerId))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Player</CardTitle>
        <CardDescription>
          {mode === 'swap'
            ? 'Swap two players between teams in one step'
            : 'Move a player to another team'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'move' ? 'default' : 'outline'}
            className="h-9 flex-1"
            onClick={() => handleModeChange('move')}
          >
            Move
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'swap' ? 'default' : 'outline'}
            className={cn('h-9 flex-1')}
            onClick={() => handleModeChange('swap')}
          >
            Swap
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {mode === 'swap' ? 'Player A' : 'Select Player'}
          </label>
          <Select
            value={selectedPlayerId}
            onValueChange={value => {
              setSelectedPlayerId(value)
              setSwapWithPlayerId('')
              const teamId = teams.find(t => t.playerIds.includes(value))?.id
              if (mode === 'swap' && teamId && targetTeamId === teamId) {
                setTargetTeamId('')
              }
            }}
          >
            <SelectTrigger className="h-11 sm:h-9">
              <SelectValue placeholder="Choose a player" />
            </SelectTrigger>
            <SelectContent>
              {availablePlayers.map(user => (
                <SelectItem key={user.uid} value={user.uid}>
                  <span
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1"
                    style={styleForTeamColor(
                      teamColorByPlayerId.get(user.uid) ?? null
                    )}
                  >
                    <span className="truncate">
                      {user.displayName}{' '}
                      {user.jerseyNumber && `#${user.jerseyNumber}`}
                      {user.position && ` (${user.position})`}
                    </span>
                    <span className="shrink-0 text-xs opacity-90">
                      {teamNameByPlayerId.get(user.uid) ?? ''}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {mode === 'swap' ? 'Player B team' : 'Transfer To'}
          </label>
          <Select
            value={targetTeamId}
            onValueChange={value => {
              setTargetTeamId(value)
              setSwapWithPlayerId('')
            }}
          >
            <SelectTrigger className="h-11 sm:h-9">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              {destinationTeams.map(team => (
                <SelectItem key={team.id} value={team.id}>
                  <span
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1"
                    style={styleForTeamColor(
                      teamColorById.get(team.id) ?? null
                    )}
                    title={teamNameById.get(team.id)}
                  >
                    <span className="truncate">
                      {teamNameById.get(team.id)} ({team.playerIds.length}/
                      {team.maxSize})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'swap' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Swap with (Player B)</label>
            <Select
              value={swapWithPlayerId}
              onValueChange={setSwapWithPlayerId}
              disabled={!targetTeamId || swapCandidates.length === 0}
            >
              <SelectTrigger className="h-11 sm:h-9">
                <SelectValue
                  placeholder={
                    !targetTeamId
                      ? 'Choose a team first'
                      : swapCandidates.length === 0
                        ? 'No players on that team'
                        : 'Choose player to swap with'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {swapCandidates.map(user => (
                  <SelectItem key={user.uid} value={user.uid}>
                    <span className="truncate">
                      {user.displayName}{' '}
                      {user.jerseyNumber && `#${user.jerseyNumber}`}
                      {user.position && ` (${user.position})`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-300 bg-red-100 p-3 text-sm font-medium text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <Button
          onClick={handleTransfer}
          disabled={!canSubmit}
          loading={loading}
          className="h-11 w-full sm:h-9"
        >
          {mode === 'swap' ? 'Swap players' : 'Transfer Player'}
        </Button>
      </CardContent>
    </Card>
  )
}
