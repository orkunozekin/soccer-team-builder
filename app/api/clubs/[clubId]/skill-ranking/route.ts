import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { auditLog } from '@/lib/services/auditService'
import { listMembershipsForClub } from '@/lib/services/clubService'
import { validateSkillRatingChanges } from '@/lib/skill/scoring'
import {
  applyClubSkillRatingChanges,
  getClubSkillRanking,
} from '@/lib/skill/skillStoreAdmin'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'
import type { ClubSkillRankingDTO, SkillRankingMemberDTO } from '@/types/skill'

type RouteContext = { params: Promise<{ clubId: string }> }

type GateResult =
  | { ok: true; uid: string; clubId: string }
  | { ok: false; response: NextResponse }

function deny(error: string, status: number): GateResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) }
}

async function authorize(
  request: NextRequest,
  context: RouteContext
): Promise<GateResult> {
  const { clubId } = await context.params
  if (!clubId) return deny('Club ID required', 400)

  const { uid, email, isClubAdmin, error } = await verifyClubAdmin(
    request,
    clubId
  )
  if (!uid || uid === 'fallback') return deny('Unauthorized', 401)
  // With a uid, an error means the membership lookup failed: retryable,
  // never "not an admin".
  if (error) {
    return deny('Could not verify club access. Please try again.', 503)
  }
  if (!isClubAdmin) return deny('Club admin privileges required', 403)

  const enabled = await evaluateFeatureFlag('skill-balanced-teams', {
    key: uid,
    email,
  })
  if (!enabled) return deny('Skill ranking is unavailable', 403)

  return { ok: true, uid, clubId }
}

/**
 * GET /api/clubs/[clubId]/skill-ranking — club admins only. The club's
 * 1–10 ratings (former members dropped) plus every active member.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const gate = await authorize(request, context)
    if (!gate.ok) return gate.response

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const memberships = await listMembershipsForClub(gate.clubId)
    const memberIds = memberships.map(m => m.userId)
    const [users, ranking] = await Promise.all([
      getUsersByIdsAdmin(adminDb, memberIds),
      getClubSkillRanking(adminDb, gate.clubId, new Set(memberIds)),
    ])
    const positionByUserId = new Map(
      users.map(user => [user.uid, user.position ?? null])
    )

    const members: SkillRankingMemberDTO[] = memberships.map(m => ({
      userId: m.userId,
      displayName: m.displayName,
      position: positionByUserId.get(m.userId) ?? null,
    }))

    return NextResponse.json({ ranking, members })
  } catch (err: unknown) {
    console.error('Error loading skill ranking:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to load skill ranking') },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/clubs/[clubId]/skill-ranking — body `{ changes }`: uid → 1–10, or
 * null to clear. Only those players change, so concurrent admin saves both
 * land; for the same player the later save wins.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const gate = await authorize(request, context)
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => null)

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const memberships = await listMembershipsForClub(gate.clubId)
    const memberIds = new Set(memberships.map(m => m.userId))
    const validation = validateSkillRatingChanges(body?.changes, memberIds)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const merged = await applyClubSkillRatingChanges(adminDb, {
      clubId: gate.clubId,
      changes: validation.changes,
      updatedBy: gate.uid,
    })

    const values = Object.values(validation.changes)
    auditLog({
      action: 'club.skill_ranking_updated',
      actorUid: gate.uid,
      entityType: 'club',
      entityId: gate.clubId,
      source: 'api',
      metadata: {
        ratedCount: values.filter(v => v !== null).length,
        clearedCount: values.filter(v => v === null).length,
        version: merged.version,
      },
    })

    const ratings = Object.fromEntries(
      Object.entries(merged.ratings).filter(([uid]) => memberIds.has(uid))
    ) as ClubSkillRankingDTO['ratings']
    return NextResponse.json({
      success: true,
      ranking: { ratings, version: merged.version },
    })
  } catch (err: unknown) {
    console.error('Error saving skill ranking:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to save skill ranking') },
      { status: 500 }
    )
  }
}
