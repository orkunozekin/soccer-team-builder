'use client'

import { useState } from 'react'
import { User } from '@/types/user'
import { Team } from '@/types/team'
import { SoccerPitch } from '@/components/teams/SoccerPitch'
import { TeamCard } from '@/components/teams/TeamCard'
import { BenchList } from '@/components/teams/BenchList'
import { Button } from '@/components/ui/button'

interface TeamsDisplayProps {
  teams: Team[]
  users: User[]
  benchPlayerIds: string[]
  isAdmin?: boolean
  onPlayerClick?: (userId: string, teamId: string | null) => void
}

export function TeamsDisplay({
  teams,
  users,
  benchPlayerIds,
  isAdmin = false,
  onPlayerClick,
}: TeamsDisplayProps) {
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Teams</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'pitch' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('pitch')}
            className="h-9"
          >
            Pitch View
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-9"
          >
            List View
          </Button>
        </div>
      </div>

      {viewMode === 'pitch' ? (
        <SoccerPitch
          teams={teams}
          users={users}
          benchPlayerIds={benchPlayerIds}
          onPlayerClick={onPlayerClick}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} users={users} />
          ))}
        </div>
      )}

      {benchPlayerIds.length > 0 && (
        <BenchList playerIds={benchPlayerIds} users={users} />
      )}
    </div>
  )
}
