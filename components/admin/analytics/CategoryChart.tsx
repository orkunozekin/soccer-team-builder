'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuditStats } from '@/lib/audit/computeAuditStats'

const BAR_COLORS = [
  'hsl(12 76% 61%)',
  'hsl(173 58% 39%)',
  'hsl(197 37% 24%)',
  'hsl(43 74% 66%)',
  'hsl(27 87% 67%)',
  'hsl(220 70% 50%)',
  'hsl(160 60% 45%)',
  'hsl(340 75% 55%)',
]

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { category: string }; value: number }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{item?.payload.category}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {item?.value ?? 0} events
      </p>
    </div>
  )
}

export function CategoryChart({ stats }: { stats: AuditStats }) {
  const data = stats.eventsByCategory.slice(0, 8)
  const hasData = data.length > 0

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Events by category</CardTitle>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Breakdown of activity types
        </p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-zinc-500"
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={80}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-zinc-500"
                />
                <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.category}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-zinc-500">
            No category data yet
          </div>
        )}
      </CardContent>
    </Card>
  )
}
