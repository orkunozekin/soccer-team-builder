'use client'

import { useState, useEffect } from 'react'
import { User } from '@/types/user'
import { Team } from '@/types/team'
import { getPitchPosition, getOffsetPosition } from '@/lib/utils/pitchLayout'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

interface PlayerOnPitch {
  user: User
  position: { x: number; y: number }
}

interface SoccerPitchProps {
  teams: Team[]
  users: User[]
  benchPlayerIds?: string[]
  onPlayerClick?: (userId: string, teamId: string | null) => void
  isAdmin?: boolean
}

export function SoccerPitch({
  teams,
  users,
  benchPlayerIds = [],
  onPlayerClick,
  isAdmin = false,
}: SoccerPitchProps) {
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0)

  // Get players for each team
  const getTeamPlayers = (team: Team): PlayerOnPitch[] => {
    const teamUsers = team.playerIds
      .map((userId) => users.find((u) => u.uid === userId))
      .filter((u): u is User => !!u)

    // Group players by position for offset calculation
    const positionGroups: Record<string, User[]> = {}
    teamUsers.forEach((user) => {
      const pos = user.position || 'CM'
      if (!positionGroups[pos]) {
        positionGroups[pos] = []
      }
      positionGroups[pos].push(user)
    })

    // Create player positions with offsets
    const players: PlayerOnPitch[] = []
    Object.entries(positionGroups).forEach(([position, positionUsers]) => {
      const basePos = getPitchPosition(position)
      positionUsers.forEach((user, index) => {
        const offsetPos = getOffsetPosition(
          basePos,
          index,
          positionUsers.length
        )
        players.push({ user, position: offsetPos })
      })
    })

    return players
  }

  // Desktop: Show both teams side by side
  // Tablet: Stack teams vertically
  // Mobile: Show one team at a time with toggle

  const [windowWidth, setWindowWidth] = useState(1024)

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth)
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  const isMobile = windowWidth < 768
  const isTablet = windowWidth >= 768 && windowWidth < 1024

  const renderPitch = (team: Team, teamIndex: number, flip: boolean = false) => {
    const players = getTeamPlayers(team)

    return (
      <div
        key={team.id}
        className={`relative w-full ${flip ? 'scale-x-[-1]' : ''}`}
        style={{ aspectRatio: '3/2' }}
      >
        {/* Soccer Field */}
        <div className="relative w-full h-full bg-green-600 rounded-lg border-4 border-white overflow-hidden">
          {/* Center Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>

          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 rounded-full border-2 border-white"></div>

          {/* Left Penalty Box */}
          <div className="absolute top-0 left-0 w-1/4 h-1/3 border-r-2 border-b-2 border-white"></div>
          <div className="absolute top-0 left-0 w-1/6 h-1/4 border-r-2 border-b-2 border-white"></div>

          {/* Right Penalty Box */}
          <div className="absolute bottom-0 right-0 w-1/4 h-1/3 border-l-2 border-t-2 border-white"></div>
          <div className="absolute bottom-0 right-0 w-1/6 h-1/4 border-l-2 border-t-2 border-white"></div>

          {/* Goal Areas */}
          <div className="absolute top-0 left-0 w-1/8 h-1/6 border-r-2 border-b-2 border-white"></div>
          <div className="absolute bottom-0 right-0 w-1/8 h-1/6 border-l-2 border-t-2 border-white"></div>

          {/* Players */}
          {players.map((playerOnPitch) => {
            const { user, position } = playerOnPitch
            const isGK = isGoalkeeper(user.position)

            return (
              <div
                key={user.uid}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  isAdmin && onPlayerClick ? 'cursor-pointer hover:scale-110' : ''
                } transition-transform`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                }}
                onClick={() => {
                  if (isAdmin && onPlayerClick) {
                    onPlayerClick(user.uid, team.id)
                  }
                }}
              >
                <div
                  className={`flex flex-col items-center justify-center rounded-full border-2 border-white shadow-lg text-white ${
                    isGK ? 'bg-yellow-500' : ''
                  }`}
                  style={{
                    width: isMobile ? '44px' : '48px',
                    height: isMobile ? '44px' : '48px',
                    minWidth: '44px',
                    minHeight: '44px',
                    backgroundColor: isGK ? undefined : team.color || '#3b82f6',
                  }}
                >
                  <span className="text-xs font-bold">
                    {user.jerseyNumber || '?'}
                  </span>
                  {!isMobile && (
                    <span className="text-[8px] leading-tight text-center px-0.5 truncate max-w-[40px]">
                      {user.displayName.split(' ')[0]}
                    </span>
                  )}
                </div>
                {!isMobile && user.position && (
                  <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] text-white font-semibold bg-black/50 px-1 rounded">
                    {user.position}
                  </span>
                )}
              </div>
            )
          })}

          {/* Team Label */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm font-semibold">
            {team.name || `Team ${team.teamNumber}`}
          </div>
        </div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
        No teams generated yet
      </div>
    )
  }

  // Mobile: Single pitch with team toggle
  if (isMobile) {
    return (
      <div className="space-y-4">
        {teams.length > 1 && (
          <div className="flex gap-2 justify-center">
            {teams.map((team, index) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamIndex(index)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  selectedTeamIndex === index
                    ? 'bg-red-50 text-white'
                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {team.name || `Team ${team.teamNumber}`}
              </button>
            ))}
          </div>
        )}
        {renderPitch(teams[selectedTeamIndex], selectedTeamIndex)}
      </div>
    )
  }

  // Tablet: Stacked vertically
  if (isTablet) {
    return (
      <div className="space-y-6">
        {teams.map((team, index) => renderPitch(team, index, index === 1))}
      </div>
    )
  }

  // Desktop: Side by side
  return (
    <div className="grid grid-cols-2 gap-4">
      {teams.slice(0, 2).map((team, index) =>
        renderPitch(team, index, index === 1)
      )}
    </div>
  )
}
