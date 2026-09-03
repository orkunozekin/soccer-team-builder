import { NextRequest, NextResponse } from 'next/server'
import { startOfDay } from 'date-fns'
import { verifyAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import {
  computeAuditStats,
  getStatsSinceDate,
} from '@/lib/audit/computeAuditStats'
import { countAuditLogs, queryAuditLogs } from '@/lib/audit/queryAuditLogs'
import { getAdminDb } from '@/lib/firebase/admin'

const CHART_DAYS = 14
const STATS_FETCH_LIMIT = 500

/**
 * GET /api/audit/stats
 * Aggregated analytics for the admin dashboard (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const since = getStatsSinceDate(CHART_DAYS)
    const todayStart = startOfDay(new Date())
    const weekStart = startOfDay(
      new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    )

    const [totalEvents, eventsToday, eventsThisWeek, { logs }] =
      await Promise.all([
        countAuditLogs(adminDb),
        countAuditLogs(adminDb, { since: todayStart }),
        countAuditLogs(adminDb, { since: weekStart }),
        queryAuditLogs(adminDb, {
          limit: STATS_FETCH_LIMIT,
          filters: { since },
        }),
      ])

    const stats = computeAuditStats(logs, {
      totalEvents,
      eventsToday,
      eventsThisWeek,
      chartDays: CHART_DAYS,
    })

    return NextResponse.json({ success: true, stats })
  } catch (error: unknown) {
    console.error('audit stats GET error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to load analytics stats') },
      { status: 500 }
    )
  }
}
