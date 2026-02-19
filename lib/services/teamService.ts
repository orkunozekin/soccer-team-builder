import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  timestampToDate,
} from '@/lib/firebase/firestore'
import { Team, TeamFirestore, Bench } from '@/types/team'

// Teams are stored as subcollection under matches
const getTeamsCollectionPath = (matchId: string) => `matches/${matchId}/teams`
const getBenchCollectionPath = (matchId: string) => `matches/${matchId}/bench`

export const createTeam = async (
  matchId: string,
  teamNumber: number,
  name: string,
  color: string,
  maxSize: number = 11
): Promise<string> => {
  const teamId = `team_${matchId}_${teamNumber}_${Date.now()}`
  const teamData: Omit<TeamFirestore, 'id' | 'createdAt' | 'updatedAt'> = {
    matchId,
    teamNumber,
    name,
    color,
    playerIds: [],
    maxSize,
  }

  await createDocument(getTeamsCollectionPath(matchId), teamId, teamData)
  return teamId
}

export const getTeam = async (
  matchId: string,
  teamId: string
): Promise<Team | null> => {
  const teamDoc = await getDocument(getTeamsCollectionPath(matchId), teamId)
  if (!teamDoc) return null

  return {
    id: teamId,
    matchId: teamDoc.matchId,
    teamNumber: teamDoc.teamNumber,
    name: teamDoc.name,
    color: teamDoc.color,
    playerIds: teamDoc.playerIds || [],
    maxSize: teamDoc.maxSize || 11,
    createdAt: timestampToDate(teamDoc.createdAt) || new Date(),
    updatedAt: timestampToDate(teamDoc.updatedAt) || new Date(),
  }
}

export const getMatchTeams = async (matchId: string): Promise<Team[]> => {
  const teams = await queryDocuments(getTeamsCollectionPath(matchId), [])

  return teams.map((team: any) => ({
    id: team.id,
    matchId: team.matchId,
    teamNumber: team.teamNumber,
    name: team.name,
    color: team.color,
    playerIds: team.playerIds || [],
    maxSize: team.maxSize || 11,
    createdAt: timestampToDate(team.createdAt) || new Date(),
    updatedAt: timestampToDate(team.updatedAt) || new Date(),
  }))
}

export const updateTeam = async (
  matchId: string,
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'color' | 'playerIds' | 'maxSize'>>
): Promise<void> => {
  await updateDocument(getTeamsCollectionPath(matchId), teamId, updates)
}

export const deleteTeam = async (
  matchId: string,
  teamId: string
): Promise<void> => {
  await deleteDocument(getTeamsCollectionPath(matchId), teamId)
}

// Bench is no longer used; return empty stub for backwards compatibility
export const getBench = async (matchId: string): Promise<Bench | null> => {
  return {
    id: `bench_${matchId}`,
    matchId,
    playerIds: [],
    updatedAt: new Date(),
  }
}

export const updateBench = async (
  _matchId: string,
  _playerIds: string[]
): Promise<void> => {
  // No-op: bench removed; all players are on teams
}
