import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { AuditStats } from '@/lib/audit/computeAuditStats'
import { cn } from '@/lib/utils'

type KpiCardProps = {
  title: string
  value: number
  subtitle: string
  icon: React.ReactNode
  accent?: 'default' | 'success' | 'warning'
}

function KpiCard({ title, value, subtitle, icon, accent = 'default' }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {value.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              accent === 'success' &&
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              accent === 'warning' &&
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              accent === 'default' &&
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalyticsKpiCards({ stats }: { stats: AuditStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Total events"
        value={stats.totalEvents}
        subtitle="All time"
        icon={<Activity className="h-5 w-5" />}
      />
      <KpiCard
        title="Today"
        value={stats.eventsToday}
        subtitle="Events in the last 24 hours"
        icon={<TrendingUp className="h-5 w-5" />}
        accent="success"
      />
      <KpiCard
        title="RSVPs this week"
        value={stats.rsvpCount}
        subtitle="Confirmed in the last 7 days"
        icon={<CalendarCheck className="h-5 w-5" />}
        accent="success"
      />
      <KpiCard
        title="Failures this week"
        value={stats.failureCount}
        subtitle="Errors and failed actions"
        icon={<AlertTriangle className="h-5 w-5" />}
        accent="warning"
      />
    </div>
  )
}
