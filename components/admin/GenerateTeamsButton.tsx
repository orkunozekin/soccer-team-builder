'use client'

import { useState } from 'react'
import { generateTeams } from '@/lib/utils/teamGenerator'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getAllUsers } from '@/lib/services/userService'
import { createTeam, getMatchTeams, deleteTeam } from '@/lib/services/teamService'
import { updateBench } from '@/lib/services/teamService'
import { Button } from '@/components/ui/button'
import { Match } from '@/types/match'

interface GenerateTeamsButtonProps {
  match: Match
  onTeamsGenerated?: () => void
}

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Orange', 'Purple']

export function GenerateTeamsButton({
  match,
  onTeamsGenerated,
}: GenerateTeamsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Fetch RSVPs and users
      const [rsvps, users] = await Promise.all([
        getMatchRSVPs(match.id),
        getAllUsers(),
      ])

      if (rsvps.length < 2) {
        setError('Need at least 2 players to generate teams')
        setLoading(false)
        return
      }

      // Generate teams
      const teamAssignments = generateTeams(rsvps, users, 11)

      // Delete existing teams
      const existingTeams = await getMatchTeams(match.id)
      for (const team of existingTeams) {
        await deleteTeam(match.id, team.id)
      }

      // Create new teams
      const allPlayerIds = new Set<string>()
      for (let i = 0; i < teamAssignments.length; i++) {
        const assignment = teamAssignments[i]
        const teamId = await createTeam(
          match.id,
          assignment.teamNumber,
          TEAM_NAMES[i] || `Team ${assignment.teamNumber}`,
          TEAM_COLORS[i] || '#3b82f6',
          11
        )

        // Update team with players
        if (assignment.playerIds.length > 0) {
          await updateTeam(match.id, teamId, {
            playerIds: assignment.playerIds,
          })
        }

        assignment.playerIds.forEach((id) => allPlayerIds.add(id))
      }

      // Put remaining players on bench
      const benchPlayerIds = rsvps
        .map((r) => r.userId)
        .filter((id) => !allPlayerIds.has(id))

      await updateBench(match.id, benchPlayerIds)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      if (onTeamsGenerated) {
        onTeamsGenerated()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate teams')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full h-11 sm:h-9"
      >
        {loading ? 'Generating Teams...' : 'Generate Teams'}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Teams generated successfully!
        </p>
      )}
    </div>
  )
}
