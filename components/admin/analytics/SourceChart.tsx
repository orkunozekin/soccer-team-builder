'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuditStats } from '@/lib/audit/computeAuditStats'

const SOURCE_COLORS: Record<string, string> = {
  api: 'hsl(12 76% 61%)',
  client: 'hsl(173 58% 39%)',
  cron: 'hsl(197 37% 24%)',
}

const SOURCE_LABELS: Record<string, string> = {
  api: 'API',
  client: 'App',
  cron: 'Scheduled',
}

function SourceTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{item?.name}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {item?.value ?? 0} events
      </p>
    </div>
  )
}

export function SourceChart({ stats }: { stats: AuditStats }) {
  const data = stats.eventsBySource.map(item => ({
    name: SOURCE_LABELS[item.source] ?? item.source,
    value: item.count,
    source: item.source,
  }))
  const hasData = data.some(item => item.value > 0)
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Event sources</CardTitle>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Where activity originates
        </p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.map(entry => (
                      <Cell
                        key={entry.source}
                        fill={SOURCE_COLORS[entry.source] ?? 'hsl(43 74% 66%)'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<SourceTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex w-full flex-col gap-2 sm:w-auto">
              {data.map(item => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                return (
                  <li
                    key={item.source}
                    className="flex items-center justify-between gap-6 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            SOURCE_COLORS[item.source] ?? 'hsl(43 74% 66%)',
                        }}
                      />
                      {item.name}
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {pct}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-sm text-zinc-500">
            No source data yet
          </div>
        )}
      </CardContent>
    </Card>
  )
}
