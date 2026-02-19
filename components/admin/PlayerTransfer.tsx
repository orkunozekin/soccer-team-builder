'use client'

import { useMemo, useState } from 'react'
import { User } from '@/types/user'
import { Team } from '@/types/team'
import { transferPlayerAPI } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PlayerTransferProps {
  matchId: string
  teams: Team[]
  users: User[]
  benchPlayerIds: string[]
  onTransferComplete?: () => void
}

export function PlayerTransfer({
  matchId,
  teams,
  users,
  benchPlayerIds,
  onTransferComplete,
}: PlayerTransferProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [targetTeamId, setTargetTeamId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Get all players (from teams and bench)
  const allPlayerIds = new Set<string>()
  teams.forEach((team) => team.playerIds.forEach((id) => allPlayerIds.add(id)))
  benchPlayerIds.forEach((id) => allPlayerIds.add(id))

  const availablePlayers = users.filter((u) => allPlayerIds.has(u.uid))

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
    () => new Map(teams.map((t) => [t.id, t.name || `Team ${t.teamNumber}`])),
    [teams]
  )
  const teamColorById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.color || '#3b82f6'])),
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

  const styleForTeamColor = (hex: string | null): React.CSSProperties | undefined => {
    if (!hex) return undefined
    // Inline style so it wins over SelectItem focus background classes.
    return {
      backgroundColor: hex,
      color: 'white',
    }
  }

  const handleTransfer = async () => {
    if (!selectedPlayerId || !targetTeamId) {
      setError('Please select both player and target team')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Find current team/bench for player
      let currentTeam: Team | null = null
      const isOnBench = benchPlayerIds.includes(selectedPlayerId)

      for (const team of teams) {
        if (team.playerIds.includes(selectedPlayerId)) {
          currentTeam = team
          break
        }
      }

      // Call API route (validation and business logic on server)
      await transferPlayerAPI(
        matchId,
        selectedPlayerId,
        targetTeamId,
        currentTeam?.id,
        isOnBench
      )

      setSelectedPlayerId('')
      setTargetTeamId('')

      if (onTransferComplete) {
        onTransferComplete()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to transfer player')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Player</CardTitle>
        <CardDescription>
          Move players between teams or to/from bench
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Player</label>
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger className="h-11 sm:h-9">
              <SelectValue placeholder="Choose a player" />
            </SelectTrigger>
            <SelectContent>
              {availablePlayers.map((user) => (
                <SelectItem key={user.uid} value={user.uid}>
                  <span
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1"
                    style={styleForTeamColor(teamColorByPlayerId.get(user.uid) ?? null)}
                    title={benchPlayerIds.includes(user.uid) ? 'Bench' : undefined}
                  >
                    <span className="truncate">
                      {user.displayName} {user.jerseyNumber && `#${user.jerseyNumber}`}
                      {user.position && ` (${user.position})`}
                    </span>
                    {!benchPlayerIds.includes(user.uid) && (
                      <span className="shrink-0 text-xs opacity-90">
                        {teamNameByPlayerId.get(user.uid) ?? ''}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Transfer To</label>
          <Select value={targetTeamId} onValueChange={setTargetTeamId}>
            <SelectTrigger className="h-11 sm:h-9">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bench">Bench</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <span
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1"
                    style={styleForTeamColor(teamColorById.get(team.id) ?? null)}
                    title={teamNameById.get(team.id)}
                  >
                    <span className="truncate">
                      {teamNameById.get(team.id)} ({team.playerIds.length}/{team.maxSize})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-100 p-3 text-sm font-medium text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <Button
          onClick={handleTransfer}
          disabled={loading || !selectedPlayerId || !targetTeamId}
          className="w-full h-11 sm:h-9"
        >
          {loading ? 'Transferring...' : 'Transfer Player'}
        </Button>
      </CardContent>
    </Card>
  )
}
