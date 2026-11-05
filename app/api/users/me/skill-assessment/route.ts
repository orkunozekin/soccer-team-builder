import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { parseSkillAnswers } from '@/lib/skill/scoring'
import {
  getSkillAssessment,
  saveSkillAssessment,
} from '@/lib/skill/skillStoreAdmin'

type GateResult =
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse }

async function authorize(request: NextRequest): Promise<GateResult> {
  const auth = await verifyAuth(request)
  if (auth.error || !auth.uid || auth.uid === 'fallback') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  const enabled = await evaluateFeatureFlag('skill-balanced-teams', {
    key: auth.uid,
    email: auth.email,
  })
  if (!enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Skill questionnaire is unavailable' },
        { status: 403 }
      ),
    }
  }
  return { ok: true, uid: auth.uid }
}

/** GET /api/users/me/skill-assessment — the caller's questionnaire. */
export async function GET(request: NextRequest) {
  try {
    const gate = await authorize(request)
    if (!gate.ok) return gate.response

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const assessment = await getSkillAssessment(adminDb, gate.uid)
    return NextResponse.json({ assessment })
  } catch (error: unknown) {
    console.error('Error loading skill assessment:', error)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          error,
          'Failed to load skill questionnaire'
        ),
      },
      { status: 500 }
    )
  }
}

/** PUT /api/users/me/skill-assessment — body `{ answers }`; upserts. */
export async function PUT(request: NextRequest) {
  try {
    const gate = await authorize(request)
    if (!gate.ok) return gate.response

    const body = await request.json().catch(() => null)
    const answers = parseSkillAnswers(body?.answers)
    if (!answers) {
      return NextResponse.json(
        { error: 'Answer every question with a value from 1 to 3' },
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

    const assessment = await saveSkillAssessment(adminDb, gate.uid, answers)
    return NextResponse.json({ success: true, assessment })
  } catch (error: unknown) {
    console.error('Error saving skill assessment:', error)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          error,
          'Failed to save skill questionnaire'
        ),
      },
      { status: 500 }
    )
  }
}
