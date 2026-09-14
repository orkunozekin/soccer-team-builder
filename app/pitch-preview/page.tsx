'use client'

import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'
import { DualTeamPitchView } from '@/components/teams/DualTeamPitchView'
import { SoccerPitch } from '@/components/teams/SoccerPitch'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import {
  getTeamPlayers,
  mapToHalfPitch,
} from '@/lib/utils/pitchLayout'
import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

function makeUser(
  uid: string,
  displayName: string,
  position: string,
  jerseyNumber: number
): User {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName,
    jerseyNumber,
    position,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeTeam(
  id: string,
  teamNumber: number,
  name: string,
  color: string,
  playerIds: string[]
): Team {
  return {
    id,
    matchId: 'preview',
    teamNumber,
    name,
    color,
    playerIds,
    maxSize: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const users: User[] = [
  makeUser('a1', 'Alex Rivera', 'GK', 1),
  makeUser('a2', 'Blake Chen', 'CB', 4),
  makeUser('a3', 'Casey Ortiz', 'CB', 5),
  makeUser('a4', 'Drew Kim', 'LB', 3),
  makeUser('a5', 'Eden Shaw', 'RB', 2),
  makeUser('a6', 'Finn Blake', 'CDM', 6),
  makeUser('a7', 'Gray Lopez', 'CM', 8),
  makeUser('a8', 'Harper Lee', 'CAM', 10),
  makeUser('a9', 'Indigo Park', 'LW', 11),
  makeUser('a10', 'Jordan Vale', 'ST', 9),
  makeUser('a11', 'Kai Morgan', 'RW', 7),
  makeUser('b1', 'Lane Soto', 'GK', 1),
  makeUser('b2', 'Morgan Yu', 'CB', 5),
  makeUser('b3', 'Noah West', 'CB', 4),
  makeUser('b4', 'Oakley Day', 'LB', 3),
  makeUser('b5', 'Parker Nix', 'RB', 2),
  makeUser('b6', 'Quinn Hale', 'CM', 8),
  makeUser('b7', 'Reese Cho', 'CM', 6),
  makeUser('b8', 'Sam Rivera', 'CAM', 10),
  makeUser('b9', 'Tatum Brooks', 'LM', 11),
  makeUser('b10', 'Uma Cross', 'ST', 9),
  makeUser('b11', 'Vince Hart', 'RM', 7),
]

const team1 = makeTeam(
  't1',
  1,
  'Team 1',
  '#2563eb',
  users.slice(0, 11).map(u => u.uid)
)
const team2 = makeTeam(
  't2',
  2,
  'Team 2',
  '#dc2626',
  users.slice(11).map(u => u.uid)
)

const rsvps: RSVP[] = users.map((u, i) => ({
  id: `r_${u.uid}`,
  matchId: 'preview',
  userId: u.uid,
  status: 'confirmed',
  position: u.position,
  jerseyNumber: u.jerseyNumber,
  attended: null,
  checkedInAt: null,
  checkInMethod: null,
  rsvpAt: new Date(Date.UTC(2024, 0, 1, 10, i)),
  updatedAt: new Date(),
}))

/**
 * Local visual preview for pitch lineup work (no auth/match data required).
 * Visit /pitch-preview while developing.
 */
export default function PitchPreviewPage() {
  const top = getTeamPlayers(team1, users, rsvps).map(p => ({
    ...p,
    position: mapToHalfPitch(p.position, 'top'),
  }))
  const bottom = getTeamPlayers(team2, users, rsvps).map(p => ({
    ...p,
    position: mapToHalfPitch(p.position, 'bottom'),
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Pitch lineup preview</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Dual-team pitch (teams 1–2) with rsvpAt slot assignment and purple
          field styling.
        </p>
      </div>

      <DualTeamPitchView
        teamTop={team1}
        teamBottom={team2}
        playersTop={top}
        playersBottom={bottom}
        isMobile={false}
        isAdmin={false}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold">SoccerPitch wrapper</h2>
        <SoccerPitch
          teams={[team1, team2]}
          users={users}
          matchRSVPs={rsvps}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          TeamsDisplay (flag on — Pitch / List toggle)
        </h2>
        <FeatureFlagContext.Provider value={{ 'pitch-lineup-view': true }}>
          <TeamsDisplay
            teams={[team1, team2]}
            users={users}
            matchRSVPs={rsvps}
            isAdmin={false}
          />
        </FeatureFlagContext.Provider>
      </div>
    </div>
  )
}
