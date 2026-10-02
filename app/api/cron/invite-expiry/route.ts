import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'
import { auditLog } from '@/lib/services/auditService'
import { markInviteExpired } from '@/lib/services/clubService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * QStash signs the destination URL; verification must use the same URL the
 * publisher used (`scheduleInviteExpiry` builds it from BASE_URL).
 */
function getCronEndpointUrl(request: NextRequest): string {
  const base = (process.env.BASE_URL || process.env.VERCEL_URL)?.replace(
    /\/$/,
    ''
  )
  if (base) {
    const scheme = base.startsWith('http') ? '' : 'https://'
    return `${scheme}${base}/api/cron/invite-expiry`
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
      return await receiver.verify({
        body,
        signature,
        url: getCronEndpointUrl(request),
      })
    } catch {
      return false
    }
  }

  const expected = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return Boolean(expected && authHeader === `Bearer ${expected}`)
}

/**
 * POST /api/cron/invite-expiry
 * Body: { inviteId }. Delivered once per invite by QStash at `expiresAt`.
 * Auth: QStash signature (when QSTASH_*_SIGNING_KEY set) or CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!(await authorizeCronRequest(request, body))) {
    console.warn('cron/invite-expiry: unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let inviteId = ''
  try {
    const parsed = JSON.parse(body) as { inviteId?: unknown }
    if (typeof parsed?.inviteId === 'string') inviteId = parsed.inviteId.trim()
  } catch {
    // fall through to the 400 below
  }
  if (!inviteId) {
    return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })
  }

  try {
    const result = await markInviteExpired(inviteId)
    if (result.changed) {
      auditLog({
        action: 'cron.invite_expired',
        actorUid: 'system',
        entityType: 'club',
        entityId: result.clubId,
        source: 'cron',
        metadata: { inviteId, code: result.code },
      })
    }
    return NextResponse.json({ ok: true, changed: result.changed })
  } catch (err) {
    console.error('cron/invite-expiry error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to expire invite') },
      { status: 500 }
    )
  }
}
