import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { auditLog } from '@/lib/services/auditService'
import { listMembershipsForClub } from '@/lib/services/clubService'
import { validateSkillRatings } from '@/lib/skill/scoring'
import {
  getClubSkillRanking,
  saveClubSkillRanking,
} from '@/lib/skill/skillStoreAdmin'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'
import type { SkillRankingMemberDTO } from '@/types/skill'

const RANKING_CONFLICT_MESSAGE =
  'Another admin changed the ratings. Reload to see their changes.'

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
 * PUT /api/clubs/[clubId]/skill-ranking — body `{ ratings, version }`,
 * ratings being uid → 1–10 for active members (absent = unrated);
 * `409` when another admin saved first.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const gate = await authorize(request, context)
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => null)
    const expectedVersion = body?.version
    if (
      typeof expectedVersion !== 'number' ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 0
    ) {
      return NextResponse.json(
        { error: 'A valid ranking version is required' },
        { status: 400 }
      )
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const memberships = await listMembershipsForClub(gate.clubId)
    const validation = validateSkillRatings(
      body?.ratings,
      new Set(memberships.map(m => m.userId))
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = await saveClubSkillRanking(adminDb, {
      clubId: gate.clubId,
      ratings: validation.ratings,
      expectedVersion,
      updatedBy: gate.uid,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: RANKING_CONFLICT_MESSAGE, code: 'version_conflict' },
        { status: 409 }
      )
    }

    auditLog({
      action: 'club.skill_ranking_updated',
      actorUid: gate.uid,
      entityType: 'club',
      entityId: gate.clubId,
      source: 'api',
      metadata: {
        ratedCount: Object.keys(validation.ratings).length,
        version: result.version,
      },
    })

    return NextResponse.json({
      success: true,
      ranking: { ratings: validation.ratings, version: result.version },
    })
  } catch (err: unknown) {
    console.error('Error saving skill ranking:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to save skill ranking') },
      { status: 500 }
    )
  }
}
