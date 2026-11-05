import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { auditLog } from '@/lib/services/auditService'
import { listMembershipsForClub } from '@/lib/services/clubService'
import { assessmentScore, validateSkillTiers } from '@/lib/skill/scoring'
import {
  getClubSkillRanking,
  getSkillAnswersForUsers,
  saveClubSkillRanking,
} from '@/lib/skill/skillStoreAdmin'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'
import {
  SKILL_TIER_KEYS,
  type SkillRankingMemberDTO,
  type SkillTierKey,
} from '@/types/skill'

const RANKING_CONFLICT_MESSAGE =
  'Another admin changed the ranking. Reload to see their changes.'

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

  const { uid, isClubAdmin, error } = await verifyClubAdmin(request, clubId)
  if (!uid || uid === 'fallback') return deny('Unauthorized', 401)
  // With a uid, an error means the membership lookup failed: retryable,
  // never "not an admin".
  if (error) {
    return deny('Could not verify club access. Please try again.', 503)
  }
  if (!isClubAdmin) return deny('Club admin privileges required', 403)

  const enabled = await evaluateFeatureFlag('skill-balanced-teams', {
    key: uid,
  })
  if (!enabled) return deny('Skill ranking is unavailable', 403)

  return { ok: true, uid, clubId }
}

/**
 * GET /api/clubs/[clubId]/skill-ranking — club admins only. The ranking
 * (former members dropped) plus every active member with a questionnaire hint.
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
    const [users, answersByUserId, ranking] = await Promise.all([
      getUsersByIdsAdmin(adminDb, memberIds),
      getSkillAnswersForUsers(adminDb, memberIds),
      getClubSkillRanking(adminDb, gate.clubId, new Set(memberIds)),
    ])
    const positionByUserId = new Map(
      users.map(user => [user.uid, user.position ?? null])
    )

    const members: SkillRankingMemberDTO[] = memberships.map(m => {
      const answers = answersByUserId.get(m.userId)
      return {
        userId: m.userId,
        displayName: m.displayName,
        position: positionByUserId.get(m.userId) ?? null,
        assessmentScore: answers ? assessmentScore(answers) : null,
      }
    })

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
 * PUT /api/clubs/[clubId]/skill-ranking — body `{ tiers, version }`.
 * Ranked uids must be active members; `409` when another admin saved first.
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
    const validation = validateSkillTiers(
      body?.tiers,
      new Set(memberships.map(m => m.userId))
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = await saveClubSkillRanking(adminDb, {
      clubId: gate.clubId,
      tiers: validation.tiers,
      expectedVersion,
      updatedBy: gate.uid,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: RANKING_CONFLICT_MESSAGE, code: 'version_conflict' },
        { status: 409 }
      )
    }

    const tierCounts = Object.fromEntries(
      SKILL_TIER_KEYS.map(tier => [tier, validation.tiers[tier].length])
    ) as Record<SkillTierKey, number>
    auditLog({
      action: 'club.skill_ranking_updated',
      actorUid: gate.uid,
      entityType: 'club',
      entityId: gate.clubId,
      source: 'api',
      metadata: {
        rankedCount: SKILL_TIER_KEYS.reduce((n, t) => n + tierCounts[t], 0),
        tierCounts,
        version: result.version,
      },
    })

    return NextResponse.json({
      success: true,
      ranking: { tiers: validation.tiers, version: result.version },
    })
  } catch (err: unknown) {
    console.error('Error saving skill ranking:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to save skill ranking') },
      { status: 500 }
    )
  }
}
