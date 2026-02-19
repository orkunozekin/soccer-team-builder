/**
 * API client helper functions
 * These functions call our Next.js API routes instead of directly calling Firebase
 */

import { auth } from '@/lib/firebase/config'

const API_BASE = '/api'

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })
}

export async function generateTeamsAPI(matchId: string): Promise<{
  success: boolean
  teamsGenerated: number
}> {
  const response = await apiRequest('/teams/generate', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate teams')
  }

  return response.json()
}

export async function transferPlayerAPI(
  matchId: string,
  playerId: string,
  targetTeamId: string | 'bench',
  currentTeamId?: string,
  isOnBench?: boolean
): Promise<{ success: boolean }> {
  const response = await apiRequest('/teams/transfer', {
    method: 'POST',
    body: JSON.stringify({
      matchId,
      playerId,
      targetTeamId,
      currentTeamId,
      isOnBench,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to transfer player')
  }

  return response.json()
}

export async function createMatchAPI(
  date: Date,
  time: string
): Promise<{ success: boolean; matchId: string }> {
  const response = await apiRequest('/matches', {
    method: 'POST',
    body: JSON.stringify({ date: date.toISOString(), time }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create match')
  }

  return response.json()
}

export type UpdateMatchPayload = {
  date?: string
  time?: string
  rsvpOpen?: boolean
  rsvpOpenAt?: string | null
  rsvpCloseAt?: string | null
}

export async function updateMatchAPI(
  matchId: string,
  updates: UpdateMatchPayload
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update match')
  }

  return response.json()
}

export async function deleteMatchAPI(matchId: string): Promise<{ success: boolean }> {
  const response = await apiRequest(`/matches/${matchId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete match')
  }

  return response.json()
}

export async function deleteUserAPI(userId: string): Promise<{ success: boolean }> {
  const response = await apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete user')
  }

  return response.json()
}

export async function searchUsersAPI(
  q: string,
  limit: number = 25
): Promise<{
  success: boolean
  users: Array<{
    uid: string
    email: string
    displayName: string
    role: 'user' | 'admin'
  }>
}> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
  })

  const response = await apiRequest(`/users/search?${params.toString()}`, {
    method: 'GET',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to search users')
  }

  return response.json()
}

export async function rebalanceTeamsAPI(matchId: string): Promise<{
  success: boolean
  teamsRebalanced: number
  assignedCounts: number[]
  benchCount: number
  rosterLimit: number
  replacements: Array<{ insertedGK: string; removedPlayer: string }>
}> {
  const response = await apiRequest('/teams/rebalance', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to rebalance teams')
  }

  return response.json()
}
