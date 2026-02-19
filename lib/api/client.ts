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
