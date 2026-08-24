import { Receiver } from '@upstash/qstash'
import { NextRequest, NextResponse } from 'next/server'
import { purgeExpiredAuditLogs } from '@/lib/audit/retention'
import { getAdminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getCronEndpointUrl(request: NextRequest): string {
  const base = (process.env.BASE_URL || process.env.VERCEL_URL)?.replace(
    /\/$/,
    ''
  )
  if (base) {
    const scheme = base.startsWith('http') ? '' : 'https://'
    return `${scheme}${base}/api/cron/audit-retention`
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
      const isValid = await receiver.verify({
        body,
        signature,
        url: getCronEndpointUrl(request),
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

async function runAuditRetention() {
  const adminDb = getAdminDb()
  if (!adminDb) {
    throw new Error('Firebase Admin not configured')
  }
  return purgeExpiredAuditLogs(adminDb)
}

export async function GET(request: NextRequest) {
  if (!(await authorizeCronRequest(request, ''))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAuditRetention()
    return NextResponse.json(result)
  } catch (err) {
    console.error('cron/audit-retention error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(err, 'Failed to purge audit logs'),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!(await authorizeCronRequest(request, body))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAuditRetention()
    return NextResponse.json(result)
  } catch (err) {
    console.error('cron/audit-retention error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(err, 'Failed to purge audit logs'),
      },
      { status: 500 }
    )
  }
}
