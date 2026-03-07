/**
 * API client helper functions
 * These functions call our Next.js API routes instead of directly calling Firebase
 */

import { auth } from '@/lib/firebase/config'
import { useAuthStore } from '@/store/authStore'

const API_BASE = '/api'

/** Get ID token: use auth.currentUser first, then fall back to store user (helps when currentUser is briefly null in prod). */
async function getIdToken(forceRefresh?: boolean): Promise<string | null> {
  const currentUser = auth.currentUser
  if (currentUser) {
    return currentUser.getIdToken(forceRefresh === true)
  }
  const storeUser = typeof window !== 'undefined' ? useAuthStore.getState().user : null
  if (storeUser) {
    return storeUser.getIdToken(forceRefresh === true)
  }
  return null
}

async function apiRequest(
  endpoint: string,
  options: RequestInit & { forceRefreshToken?: boolean } = {}
): Promise<Response> {
  const { forceRefreshToken, ...fetchOptions } = options
  const token = await getIdToken(forceRefreshToken === true)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
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

export async function confirmRSVPAPI(
  matchId: string,
  position?: string | null,
  /** When set (admin only), RSVP is created for this user instead of the authenticated user. */
  impersonateUserId?: string | null
): Promise<{
  rsvpId: string
  regenerated: boolean
  position: string | null
}> {
  const body: { matchId: string; position?: string | null; impersonateUserId?: string } = { matchId }
  if (position !== undefined) body.position = position
  if (impersonateUserId) body.impersonateUserId = impersonateUserId
  const response = await apiRequest('/rsvp', {
    method: 'POST',
    body: JSON.stringify(body),
    forceRefreshToken: true,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to confirm RSVP')
  }

  return response.json()
}

export async function cancelRSVPAPI(rsvpId: string): Promise<{
  cancelled: boolean
  teamsUpdated: boolean
}> {
  const response = await apiRequest('/rsvp', {
    method: 'PATCH',
    body: JSON.stringify({ rsvpId }),
    forceRefreshToken: true,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to cancel RSVP')
  }

  return response.json()
}

export async function updateRSVPPositionAPI(
  rsvpId: string,
  position: string | null
): Promise<{
  updated: boolean
  swapOccurred?: boolean
  otherPlayerDisplayName?: string
  swapWithReplacedPlayer?: boolean
  teamsUpdated?: boolean
}> {
  const response = await apiRequest('/rsvp', {
    method: 'PATCH',
    body: JSON.stringify({ rsvpId, position }),
    forceRefreshToken: true,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update position')
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
  time: string,
  location?: string | null
): Promise<{ success: boolean; matchId: string }> {
  const response = await apiRequest('/matches', {
    method: 'POST',
    body: JSON.stringify({
      date: date.toISOString(),
      time,
      location: location ?? null,
    }),
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
  location?: string | null
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
