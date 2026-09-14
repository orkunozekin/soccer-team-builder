'use client'

import { useMemo, useState } from 'react'
import { DualTeamPitchView } from './DualTeamPitchView'
import { SinglePitchView } from './SinglePitchView'
import { TeamToggle } from './TeamToggle'
import { useWindowWidth } from '@/lib/hooks/useWindowWidth'
import { layoutTeamOnPitch } from '@/lib/utils/pitchLayout'
import type { RSVP } from '@/types/rsvp'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export interface SoccerPitchProps {
  teams: Team[]
  users: User[]
  matchRSVPs?: RSVP[]
  benchPlayerIds?: string[]
  onPlayerClick?: (userId: string, teamId: string | null) => void
  isAdmin?: boolean
  currentUserId?: string | null
}

export function SoccerPitch({
  teams,
  users,
  matchRSVPs = [],
  onPlayerClick,
  isAdmin = false,
  currentUserId = null,
}: SoccerPitchProps) {
  const [selectedExtraIndex, setSelectedExtraIndex] = useState(0)
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 768

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => (a.teamNumber ?? 0) - (b.teamNumber ?? 0)),
    [teams]
  )

  const primaryPair = useMemo(() => {
    const t1 = sortedTeams.find(t => t.teamNumber === 1)
    const t2 = sortedTeams.find(t => t.teamNumber === 2)
    if (t1 && t2) return [t1, t2] as const
    if (sortedTeams.length >= 2) {
      return [sortedTeams[0], sortedTeams[1]] as const
    }
    return null
  }, [sortedTeams])

  const extraTeams = useMemo(() => {
    if (!primaryPair) return sortedTeams
    const pairIds = new Set(primaryPair.map(t => t.id))
    return sortedTeams.filter(t => !pairIds.has(t.id))
  }, [sortedTeams, primaryPair])

  if (sortedTeams.length === 0) {
    return (
      <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
        No teams generated yet
      </div>
    )
  }

  // Single team only — keep players in their own half (not full-pitch spread).
  if (!primaryPair) {
    const team = sortedTeams[0]
    return (
      <SinglePitchView
        team={team}
        players={layoutTeamOnPitch(team, users, matchRSVPs, 'bottom')}
        isMobile={isMobile}
        isAdmin={isAdmin}
        onPlayerClick={onPlayerClick}
        currentUserId={currentUserId}
      />
    )
  }

  const [teamTop, teamBottom] = primaryPair
  const dual = (
    <DualTeamPitchView
      teamTop={teamTop}
      teamBottom={teamBottom}
      playersTop={layoutTeamOnPitch(teamTop, users, matchRSVPs, 'top')}
      playersBottom={layoutTeamOnPitch(teamBottom, users, matchRSVPs, 'bottom')}
      isMobile={isMobile}
      isAdmin={isAdmin}
      onPlayerClick={onPlayerClick}
      currentUserId={currentUserId}
    />
  )

  if (extraTeams.length === 0) {
    return <div className="space-y-4">{dual}</div>
  }

  const safeExtraIndex = Math.min(
    selectedExtraIndex,
    Math.max(0, extraTeams.length - 1)
  )
  const selectedExtra = extraTeams[safeExtraIndex]

  return (
    <div className="space-y-6">
      {dual}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Additional teams
        </h3>
        {extraTeams.length > 1 && (isMobile || extraTeams.length > 2) ? (
          <>
            <TeamToggle
              teams={extraTeams}
              selectedIndex={safeExtraIndex}
              onSelect={setSelectedExtraIndex}
            />
            {selectedExtra ? (
              <SinglePitchView
                team={selectedExtra}
                players={layoutTeamOnPitch(
                  selectedExtra,
                  users,
                  matchRSVPs,
                  'bottom'
                )}
                isMobile={isMobile}
                isAdmin={isAdmin}
                onPlayerClick={onPlayerClick}
                currentUserId={currentUserId}
              />
            ) : null}
          </>
        ) : (
          <div className="space-y-4">
            {extraTeams.map(team => (
              <SinglePitchView
                key={team.id}
                team={team}
                players={layoutTeamOnPitch(team, users, matchRSVPs, 'bottom')}
                isMobile={isMobile}
                isAdmin={isAdmin}
                onPlayerClick={onPlayerClick}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
