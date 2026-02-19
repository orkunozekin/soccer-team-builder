'use client'

import { useState } from 'react'
import { Team } from '@/types/team'
import { User } from '@/types/user'
import { getTeamPlayers } from '@/lib/utils/pitchLayout'
import { useWindowWidth } from '@/lib/hooks/useWindowWidth'
import { SinglePitchView } from './SinglePitchView'
import { TeamToggle } from './TeamToggle'

export interface SoccerPitchProps {
  teams: Team[]
  users: User[]
  benchPlayerIds?: string[]
  onPlayerClick?: (userId: string, teamId: string | null) => void
  isAdmin?: boolean
}

export function SoccerPitch({
  teams,
  users,
  onPlayerClick,
  isAdmin = false,
}: SoccerPitchProps) {
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0)
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 768

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
        No teams generated yet
      </div>
    )
  }

  if (isMobile) {
    const team = teams[selectedTeamIndex]
    const players = getTeamPlayers(team, users)
    return (
      <div className="space-y-4">
        {teams.length > 1 && (
          <TeamToggle
            teams={teams}
            selectedIndex={selectedTeamIndex}
            onSelect={setSelectedTeamIndex}
          />
        )}
        <SinglePitchView
          team={team}
          players={players}
          isMobile={isMobile}
          isAdmin={isAdmin}
          onPlayerClick={onPlayerClick}
        />
      </div>
    )
  }

  // Tablet and desktop: both teams stacked (one above the other)
  return (
    <div className="space-y-6">
      {teams.map((team, index) => (
        <SinglePitchView
          key={team.id}
          team={team}
          players={getTeamPlayers(team, users)}
          isMobile={isMobile}
          isAdmin={isAdmin}
          onPlayerClick={onPlayerClick}
          flipY={index === 1}
        />
      ))}
    </div>
  )
}
