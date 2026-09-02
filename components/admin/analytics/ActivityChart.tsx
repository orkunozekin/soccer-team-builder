'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuditStats } from '@/lib/audit/computeAuditStats'

const CHART_COLOR = 'hsl(12 76% 61%)'

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {payload[0]?.value ?? 0} events
      </p>
    </div>
  )
}

export function ActivityChart({ stats }: { stats: AuditStats }) {
  const hasData = stats.eventsByDay.some(day => day.count > 0)

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Activity over time</CardTitle>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Daily event volume for the last 14 days
        </p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.eventsByDay}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-zinc-500"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-zinc-500"
                />
                <Tooltip content={<ActivityTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  fill="url(#activityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-zinc-500">
            No activity in this period yet
          </div>
        )}
      </CardContent>
    </Card>
  )
}
