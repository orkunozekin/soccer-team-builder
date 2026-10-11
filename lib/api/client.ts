/**
 * API client helper functions
 * These functions call our Next.js API routes instead of directly calling Firebase
 */

import type { AuditStats } from '@/lib/audit/computeAuditStats'
import { auth } from '@/lib/firebase/config'
import { useAuthStore } from '@/store/authStore'
import type {
  AuditAction,
  AuditEntityType,
  AuditLog,
  AuditSource,
} from '@/types/auditLog'
import type {
  Club,
  ClubInvite,
  ClubMembershipRole,
  ClubMembershipWithClub,
  ClubMembershipWithUser,
} from '@/types/club'

const API_BASE = '/api'

/** Get ID token: use auth.currentUser first, then fall back to store user (helps when currentUser is briefly null in prod). */
async function getIdToken(forceRefresh?: boolean): Promise<string | null> {
  const currentUser = auth.currentUser
  if (currentUser) {
    return currentUser.getIdToken(forceRefresh === true)
  }
  const storeUser =
    typeof window !== 'undefined' ? useAuthStore.getState().user : null
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
  jerseyNumber: number | null
}> {
  const body: {
    matchId: string
    position?: string | null
    impersonateUserId?: string
  } = { matchId }
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
  isOnBench?: boolean,
  swapWithPlayerId?: string
): Promise<{ success: boolean; swapped?: boolean }> {
  const response = await apiRequest('/teams/transfer', {
    method: 'POST',
    body: JSON.stringify({
      matchId,
      playerId,
      targetTeamId,
      currentTeamId,
      isOnBench,
      ...(swapWithPlayerId ? { swapWithPlayerId } : {}),
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
  location?: {
    name: string
    address: string
    lat: number | null
    lng: number | null
  } | null,
  clubId?: string | null
): Promise<{ success: boolean; matchId: string }> {
  const body: {
    date: string
    time: string
    location: {
      name: string
      address: string
      lat: number | null
      lng: number | null
    } | null
    clubId?: string
  } = {
    date: date.toISOString(),
    time,
    location: location ?? null,
  }
  if (typeof clubId === 'string' && clubId.trim()) {
    body.clubId = clubId.trim()
  }

  const response = await apiRequest('/matches', {
    method: 'POST',
    body: JSON.stringify(body),
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
  location?: {
    name: string
    address: string
    lat: number | null
    lng: number | null
  } | null
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

export async function deleteMatchAPI(
  matchId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/matches/${matchId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete match')
  }

  return response.json()
}

export async function deleteUserAPI(
  userId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete user')
  }

  return response.json()
}

export async function updateProfileAPI(updates: {
  displayName?: string
  jerseyNumber?: number | null
  position?: string | null
  syncEmail?: boolean
  /** Set the active club, or null to clear */
  activeClubId?: string | null
}): Promise<{ success: boolean }> {
  const response = await apiRequest('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
    forceRefreshToken: updates.syncEmail === true,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update profile')
  }

  return response.json()
}

export async function updateUserRoleAPI(
  userId: string,
  role: 'user' | 'super_user'
): Promise<{ success: boolean; role: 'user' | 'super_user' }> {
  const response = await apiRequest(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update user role')
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
    role: 'user' | 'super_user'
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

export async function applyFormationAPI(
  matchId: string,
  formationId: string
): Promise<{
  success: boolean
  formationId: string
  teamsUpdated: number
  positionsChanged: number
  assignments: Array<{
    userId: string
    fromPosition: string
    toPosition: string
    teamNumber: number
  }>
}> {
  const response = await apiRequest('/teams/formation', {
    method: 'POST',
    body: JSON.stringify({ matchId, formationId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to apply formation')
  }

  return response.json()
}

export async function checkInAPI(
  matchId: string,
  coords: { lat: number; lng: number; accuracy?: number | null }
): Promise<{
  success: boolean
  alreadyCheckedIn?: boolean
  rsvpId: string
}> {
  const response = await apiRequest('/check-in', {
    method: 'POST',
    body: JSON.stringify({
      matchId,
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy ?? null,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to check in')
  }

  return response.json()
}

export async function hostCheckInAPI(
  matchId: string,
  userId: string,
  attended: boolean
): Promise<{ success: boolean; rsvpId: string; attended: boolean }> {
  const response = await apiRequest('/check-in/host', {
    method: 'POST',
    body: JSON.stringify({ matchId, userId, attended }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update attendance')
  }

  return response.json()
}

export type ScheduleAPIPayload = {
  name: string
  cadence: 'weekly' | 'monthly'
  interval: number
  slots: Array<{
    id?: string
    day: number
    time: string
    location?: {
      name: string
      address: string
      lat: number | null
      lng: number | null
    } | null
  }>
  active?: boolean
}

export async function listSchedulesAPI(): Promise<{
  schedules: import('@/types/schedule').MatchSchedule[]
}> {
  const response = await apiRequest('/schedules', { method: 'GET' })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to list schedules')
  }
  return response.json()
}

export async function createScheduleAPI(
  payload: ScheduleAPIPayload
): Promise<{
  success: boolean
  schedule: import('@/types/schedule').MatchSchedule
}> {
  const response = await apiRequest('/schedules', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create schedule')
  }
  return response.json()
}

export async function updateScheduleAPI(
  scheduleId: string,
  payload: Partial<ScheduleAPIPayload> & { active?: boolean }
): Promise<{
  success: boolean
  schedule: import('@/types/schedule').MatchSchedule
}> {
  const response = await apiRequest(`/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update schedule')
  }
  return response.json()
}

export async function deleteScheduleAPI(
  scheduleId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/schedules/${scheduleId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete schedule')
  }
  return response.json()
}

export async function hostCheckInAllAPI(
  matchId: string
): Promise<{
  success: boolean
  updated: Array<{ rsvpId: string; userId: string }>
  message?: string
}> {
  const response = await apiRequest('/check-in/host-all', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to mark everyone present')
  }

  return response.json()
}

export type SavedLocationPayload = {
  name: string
  address: string
  lat: number | null
  lng: number | null
}

export type SavedLocationAPIResult = SavedLocationPayload & {
  id: string
  createdAt: string | null
  updatedAt: string | null
}

export async function createSavedLocationAPI(
  location: SavedLocationPayload
): Promise<{
  success: boolean
  locationId: string
  location: SavedLocationAPIResult
}> {
  const response = await apiRequest('/locations', {
    method: 'POST',
    body: JSON.stringify(location),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create saved location')
  }

  return response.json()
}

export async function updateSavedLocationAPI(
  locationId: string,
  location: SavedLocationPayload
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(location),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update saved location')
  }

  return response.json()
}

export async function deleteSavedLocationAPI(
  locationId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest(`/locations/${locationId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete saved location')
  }

  return response.json()
}

export async function listAuditLogsAPI(params: {
  limit?: number
  cursor?: string | null
  includeCount?: boolean
  action?: AuditAction | ''
  source?: AuditSource | ''
  actorUid?: string
  targetUid?: string
  matchId?: string
}): Promise<{
  success: boolean
  logs: AuditLog[]
  nextCursor: string | null
  totalCount?: number
}> {
  const search = new URLSearchParams()
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.includeCount) search.set('includeCount', 'true')
  if (params.action) search.set('action', params.action)
  if (params.source) search.set('source', params.source)
  if (params.actorUid?.trim()) search.set('actorUid', params.actorUid.trim())
  if (params.targetUid?.trim()) search.set('targetUid', params.targetUid.trim())
  if (params.matchId?.trim()) search.set('matchId', params.matchId.trim())

  const qs = search.toString()
  const response = await apiRequest(`/audit${qs ? `?${qs}` : ''}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to load analytics')
  }

  return response.json()
}

export async function getAuditStatsAPI(): Promise<{
  success: boolean
  stats: AuditStats
}> {
  const response = await apiRequest('/audit/stats')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to load analytics stats')
  }

  return response.json()
}

/**
 * Record a client-side audit event. Fire-and-forget; failures are logged but not thrown.
 */
export function recordAuditEventAPI(input: {
  action: AuditAction
  targetUid?: string
  matchId?: string
  entityType?: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
}): void {
  void apiRequest('/audit', {
    method: 'POST',
    body: JSON.stringify(input),
  }).catch(err => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[audit] Failed to record client event:', err)
    }
  })
}

export async function getMyClubsAPI(): Promise<{
  success: boolean
  memberships: ClubMembershipWithClub[]
}> {
  const response = await apiRequest('/clubs/mine', { method: 'GET' })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to load clubs')
  }
  return response.json()
}

/** Club by slug when the caller is a member or super_user. */
export async function getClubBySlugAPI(slug: string): Promise<{
  success: boolean
  club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
}> {
  const response = await apiRequest(
    `/clubs/by-slug/${encodeURIComponent(slug)}`,
    { method: 'GET' }
  )
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const err = new Error(
      (error as { error?: string }).error || 'Failed to load club'
    ) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  return response.json()
}

/** Club by id when the caller is a member or super_user. */
export async function getClubByIdAPI(clubId: string): Promise<{
  success: boolean
  club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
}> {
  const response = await apiRequest(`/clubs/${encodeURIComponent(clubId)}`, {
    method: 'GET',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const err = new Error(
      (error as { error?: string }).error || 'Failed to load club'
    ) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  return response.json()
}

export async function createClubAPI(input: {
  name: string
  settings?: { allowPlayerInvites?: boolean }
}): Promise<{ success: boolean; club: Club }> {
  const response = await apiRequest('/clubs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create club')
  }
  return response.json()
}

export async function updateClubAPI(
  clubId: string,
  updates: { name?: string; settings?: { allowPlayerInvites?: boolean } }
): Promise<{ success: boolean; club: Club }> {
  const response = await apiRequest(`/clubs/${clubId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update club')
  }
  return response.json()
}

export async function createClubInviteAPI(
  clubId: string,
  options?: { maxUses?: number | null }
): Promise<{ success: boolean; invite: ClubInvite; link: string }> {
  const response = await apiRequest(`/clubs/${clubId}/invites`, {
    method: 'POST',
    body: JSON.stringify(options ?? {}),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create invite')
  }
  return response.json()
}

export async function listClubMembersAPI(
  clubId: string
): Promise<{ success: boolean; members: ClubMembershipWithUser[] }> {
  const response = await apiRequest(`/clubs/${clubId}/members`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to list members')
  }
  return response.json()
}

export async function updateClubMemberRoleAPI(
  clubId: string,
  userId: string,
  role: ClubMembershipRole
): Promise<{ success: boolean; membership: { id: string; role: ClubMembershipRole } }> {
  const response = await apiRequest(`/clubs/${clubId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update member role')
  }
  return response.json()
}

export async function listClubInvitesAPI(
  clubId: string
): Promise<{
  success: boolean
  invites: Array<ClubInvite & { link: string }>
}> {
  const response = await apiRequest(`/clubs/${clubId}/invites`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to list invites')
  }
  return response.json()
}

export async function revokeClubInviteAPI(
  clubId: string,
  inviteId: string
): Promise<{ success: boolean; invite: ClubInvite }> {
  const response = await apiRequest(
    `/clubs/${clubId}/invites/${inviteId}/revoke`,
    { method: 'POST' }
  )
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to revoke invite')
  }
  return response.json()
}

export async function redeemInviteAPI(
  code: string
): Promise<{
  success: boolean
  alreadyMember: boolean
  clubId: string
}> {
  const response = await apiRequest('/invites/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to redeem invite')
  }
  return response.json()
}

/** Public preview: resolve invite code to club name (no auth required). */
export async function previewInviteAPI(
  code: string
): Promise<{ success: boolean; clubId: string; clubName: string }> {
  const response = await fetch(
    `/api/invites/preview?code=${encodeURIComponent(code.trim())}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  )
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      (error as { error?: string }).error || 'Failed to preview invite'
    )
  }
  return response.json()
}

export async function backfillClubMembershipsAPI(
  clubId: string
): Promise<Record<string, unknown>> {
  const response = await apiRequest('/admin/backfill-club-memberships', {
    method: 'POST',
    body: JSON.stringify({ clubId }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to backfill memberships')
  }
  return response.json()
}

