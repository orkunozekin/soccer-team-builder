import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'
import { materializeAllActiveSchedules } from '@/lib/schedules/materializeSchedule'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Canonical URL for this endpoint. QStash signs the destination URL; verification
 * must use the same URL. On Vercel, request.url can differ (proxy/internal), so
 * we use BASE_URL when set.
 */
function getCronEndpointUrl(request: NextRequest): string {
  const base = (process.env.BASE_URL || process.env.VERCEL_URL)?.replace(
    /\/$/,
    ''
  )
  if (base) {
    const scheme = base.startsWith('http') ? '' : 'https://'
    return `${scheme}${base}/api/cron/materialize-schedules`
  }
  return request.url
}

async function authorizeCronRequest(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const signature =
    request.headers.get('Upstash-Signature') ??
    request.headers.get('upstash-signature')
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() ?? ''
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim() ?? ''

  if (signature && (currentKey || nextKey)) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      })
      const verifyUrl = getCronEndpointUrl(request)
      const isValid = await receiver.verify({
        body,
        signature,
        url: verifyUrl,
      })
      return isValid
    } catch {
      return false
    }
  }

  const expected = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return Boolean(expected && authHeader === `Bearer ${expected}`)
}

async function runMaterialize() {
  return materializeAllActiveSchedules()
}

/**
 * GET /api/cron/materialize-schedules
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!(await authorizeCronRequest(request, ''))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMaterialize()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('cron/materialize-schedules error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          err,
          'Failed to materialize match schedules'
        ),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/materialize-schedules
 * Auth: QStash signature or CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!(await authorizeCronRequest(request, body))) {
    console.warn(
      'cron/materialize-schedules: unauthorized (signature verification failed or missing CRON_SECRET)'
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMaterialize()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('cron/materialize-schedules error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          err,
          'Failed to materialize match schedules'
        ),
      },
      { status: 500 }
    )
  }
}
