import {
  format,
  startOfDay,
  subDays,
  eachDayOfInterval,
  isAfter,
} from 'date-fns'
import type { AuditLog } from '@/types/auditLog'

export type AuditStats = {
  totalEvents: number
  eventsToday: number
  eventsThisWeek: number
  rsvpCount: number
  failureCount: number
  eventsByDay: { date: string; label: string; count: number }[]
  eventsByCategory: { category: string; count: number }[]
  eventsBySource: { source: string; count: number }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Auth',
  user: 'Users',
  rsvp: 'RSVPs',
  check_in: 'Check-ins',
  match: 'Matches',
  team: 'Teams',
  location: 'Locations',
  cron: 'System',
}

function getActionCategory(action: string): string {
  const prefix = action.split('.')[0] ?? 'other'
  return CATEGORY_LABELS[prefix] ?? 'Other'
}

function isFailedAction(action: string, metadata?: Record<string, unknown>): boolean {
  return (
    action.includes('_failed') ||
    action.endsWith('.failed') ||
    metadata?.outcome === 'failed'
  )
}

export function computeAuditStats(
  logs: AuditLog[],
  options: {
    totalEvents: number
    eventsToday: number
    eventsThisWeek: number
    chartDays?: number
  }
): AuditStats {
  const chartDays = options.chartDays ?? 14
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfDay(subDays(now, 6))
  const chartStart = startOfDay(subDays(now, chartDays - 1))

  const dayKeys = eachDayOfInterval({ start: chartStart, end: todayStart })
  const countsByDay = new Map(
    dayKeys.map(day => [format(day, 'yyyy-MM-dd'), 0])
  )

  const categoryCounts = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  let rsvpCount = 0
  let failureCount = 0

  for (const log of logs) {
    const createdAt = new Date(log.createdAt)
    if (Number.isNaN(createdAt.getTime())) continue

    const dayKey = format(createdAt, 'yyyy-MM-dd')
    if (countsByDay.has(dayKey)) {
      countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1)
    }

    if (isAfter(createdAt, weekStart) || createdAt.getTime() === weekStart.getTime()) {
      if (log.action === 'rsvp.confirmed') rsvpCount += 1
      if (isFailedAction(log.action, log.metadata)) failureCount += 1
    }

    const category = getActionCategory(log.action)
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)

    sourceCounts.set(log.source, (sourceCounts.get(log.source) ?? 0) + 1)
  }

  const eventsByDay = dayKeys.map(day => {
    const key = format(day, 'yyyy-MM-dd')
    return {
      date: key,
      label: format(day, 'MMM d'),
      count: countsByDay.get(key) ?? 0,
    }
  })

  const eventsByCategory = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  const eventsBySource = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalEvents: options.totalEvents,
    eventsToday: options.eventsToday,
    eventsThisWeek: options.eventsThisWeek,
    rsvpCount,
    failureCount,
    eventsByDay,
    eventsByCategory,
    eventsBySource,
  }
}

export function getStatsSinceDate(days: number): Date {
  return startOfDay(subDays(new Date(), days - 1))
}
