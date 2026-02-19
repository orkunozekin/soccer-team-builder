'use client'

import { useState } from 'react'
import { User } from '@/types/user'
import { Team } from '@/types/team'
import { updateTeam, updateBench, getBench } from '@/lib/services/teamService'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'
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
      let isOnBench = benchPlayerIds.includes(selectedPlayerId)

      for (const team of teams) {
        if (team.playerIds.includes(selectedPlayerId)) {
          currentTeam = team
          break
        }
      }

      const player = users.find((u) => u.uid === selectedPlayerId)
      const isGK = player && isGoalkeeper(player.position)

      // Check if target is bench
      if (targetTeamId === 'bench') {
        // Move to bench
        if (currentTeam) {
          // Remove from team
          const newPlayerIds = currentTeam.playerIds.filter(
            (id) => id !== selectedPlayerId
          )
          await updateTeam(matchId, currentTeam.id, {
            playerIds: newPlayerIds,
          })
        }

        // Add to bench
        const newBenchIds = [...benchPlayerIds]
        if (!newBenchIds.includes(selectedPlayerId)) {
          newBenchIds.push(selectedPlayerId)
          await updateBench(matchId, newBenchIds)
        }
      } else {
        // Move to team
        const targetTeam = teams.find((t) => t.id === targetTeamId)
        if (!targetTeam) {
          setError('Target team not found')
          setLoading(false)
          return
        }

        // Check team size
        if (targetTeam.playerIds.length >= targetTeam.maxSize) {
          setError(`Team is full (${targetTeam.maxSize} players)`)
          setLoading(false)
          return
        }

        // Check goalkeeper limit (max 1 per team)
        if (isGK) {
          const hasGK = targetTeam.playerIds.some((id) => {
            const p = users.find((u) => u.uid === id)
            return p && isGoalkeeper(p.position)
          })
          if (hasGK) {
            setError('Team already has a goalkeeper')
            setLoading(false)
            return
          }
        }

        // Remove from current location
        if (currentTeam) {
          const newPlayerIds = currentTeam.playerIds.filter(
            (id) => id !== selectedPlayerId
          )
          await updateTeam(matchId, currentTeam.id, {
            playerIds: newPlayerIds,
          })
        } else if (isOnBench) {
          const newBenchIds = benchPlayerIds.filter(
            (id) => id !== selectedPlayerId
          )
          await updateBench(matchId, newBenchIds)
        }

        // Add to target team
        const newPlayerIds = [...targetTeam.playerIds, selectedPlayerId]
        await updateTeam(matchId, targetTeam.id, {
          playerIds: newPlayerIds,
        })
      }

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
                  {user.displayName} {user.jerseyNumber && `#${user.jerseyNumber}`}
                  {user.position && ` (${user.position})`}
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
                  {team.name || `Team ${team.teamNumber}`} ({team.playerIds.length}/{team.maxSize})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
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
