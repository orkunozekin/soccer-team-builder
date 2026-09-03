'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  LogIn,
  MapPin,
  Shield,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listAuditLogsAPI } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import {
  ALL_AUDIT_ACTIONS,
  ALL_AUDIT_SOURCES,
  type AuditAction,
  type AuditLog,
  type AuditSource,
} from '@/types/auditLog'

const PAGE_SIZE = 15

type FilterState = {
  action: AuditAction | ''
  source: AuditSource | ''
  actorUid: string
  targetUid: string
  matchId: string
}

const EMPTY_FILTERS: FilterState = {
  action: '',
  source: '',
  actorUid: '',
  targetUid: '',
  matchId: '',
}

function formatAction(action: string): string {
  return action.replace(/\./g, ' · ')
}

function getActionDescription(log: AuditLog): string {
  const actor = log.actorDisplayName ?? 'Someone'
  switch (log.action) {
    case 'auth.login':
      return `${actor} signed in`
    case 'auth.register':
      return `${actor} created an account`
    case 'auth.login_failed':
      return `Failed sign-in attempt`
    case 'auth.register_failed':
      return `Failed registration attempt`
    case 'rsvp.confirmed':
      return `${actor} confirmed RSVP`
    case 'rsvp.cancelled':
      return `${actor} cancelled RSVP`
    case 'rsvp.failed':
      return `RSVP failed for ${actor}`
    case 'check_in.geo':
      return `${actor} checked in`
    case 'check_in.host':
      return `${actor} checked in as host`
    case 'check_in.failed':
      return `Check-in failed for ${actor}`
    case 'match.created':
      return `${actor} created a match`
    case 'match.updated':
      return `${actor} updated a match`
    case 'match.deleted':
      return `${actor} deleted a match`
    case 'team.generated':
      return `Teams generated for a match`
    case 'user.role_changed':
      return `${actor} changed a user role`
    case 'user.deleted':
      return `${actor} deleted a user`
    case 'location.created':
      return `${actor} added a location`
    case 'location.updated':
      return `${actor} updated a location`
    case 'location.deleted':
      return `${actor} removed a location`
    default:
      return formatAction(log.action)
  }
}

function getActionIcon(action: string) {
  if (action.startsWith('auth.')) return LogIn
  if (action.startsWith('rsvp.') || action.startsWith('check_in.')) return Calendar
  if (action.startsWith('match.') || action.startsWith('team.')) return Users
  if (action.startsWith('location.')) return MapPin
  if (action.startsWith('user.')) return User
  if (action.startsWith('cron.')) return Shield
  return AlertCircle
}

function isFailedLog(log: AuditLog): boolean {
  return (
    log.action.includes('_failed') ||
    log.action.endsWith('.failed') ||
    log.metadata?.outcome === 'failed'
  )
}

function EventRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = getActionIcon(log.action)
  const failed = isFailedLog(log)
  const description = getActionDescription(log)
  const relativeTime = formatDistanceToNow(new Date(log.createdAt), {
    addSuffix: true,
  })

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3 transition-colors',
        failed
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          failed
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {description}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {relativeTime} · {format(new Date(log.createdAt), 'MMM d, h:mm a')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs">
              {log.source}
            </Badge>
            {failed ? (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            ) : null}
          </div>
        </div>

        {typeof log.metadata?.message === 'string' && failed ? (
          <p className="text-xs text-red-700 dark:text-red-400">
            {log.metadata.message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
          {expanded ? 'Hide details' : 'Show details'}
        </button>

        {expanded ? (
          <dl className="grid gap-2 rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-900/50 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Action</dt>
              <dd className="font-mono">{log.action}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Actor</dt>
              <dd>
                {log.actorUid === 'system' || log.actorUid === 'anonymous' ? (
                  <span className="font-mono text-zinc-500">{log.actorUid}</span>
                ) : (
                  <Link
                    href={`/admin/players/${log.actorUid}`}
                    className="text-red-700 hover:underline dark:text-red-400"
                  >
                    {log.actorDisplayName ?? log.actorUid.slice(0, 8)}
                  </Link>
                )}
              </dd>
            </div>
            {log.targetUid ? (
              <div>
                <dt className="text-zinc-500">Target</dt>
                <dd>
                  <Link
                    href={`/admin/players/${log.targetUid}`}
                    className="text-red-700 hover:underline dark:text-red-400"
                  >
                    {log.targetDisplayName ?? log.targetUid.slice(0, 8)}
                  </Link>
                </dd>
              </div>
            ) : null}
            {log.matchId ? (
              <div>
                <dt className="text-zinc-500">Match</dt>
                <dd>
                  <Link
                    href={`/admin/matches/${log.matchId}`}
                    className="font-mono text-red-700 hover:underline dark:text-red-400"
                  >
                    {log.matchId.slice(0, 12)}…
                  </Link>
                </dd>
              </div>
            ) : null}
            {log.metadata && Object.keys(log.metadata).length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="mb-1 text-zinc-500">Metadata</dt>
                <dd>
                  <pre className="max-w-full overflow-x-auto rounded bg-white p-2 font-mono text-[11px] dark:bg-zinc-950">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </div>
  )
}

export function AuditEventLog() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchPage = useCallback(
    async (pageNum: number, cursor: string | null, nextFilters: FilterState) => {
      setLoading(true)
      setError('')
      try {
        const result = await listAuditLogsAPI({
          limit: PAGE_SIZE,
          cursor,
          includeCount: pageNum === 1,
          action: nextFilters.action,
          source: nextFilters.source,
          actorUid: nextFilters.actorUid,
          targetUid: nextFilters.targetUid,
          matchId: nextFilters.matchId,
        })

        setLogs(result.logs)
        if (pageNum === 1 && result.totalCount != null) {
          setTotalCount(result.totalCount)
        }
        setCursors(prev => {
          const next = [...prev]
          next[pageNum - 1] = result.nextCursor
          return next
        })
      } catch (err: unknown) {
        setLogs([])
        setError(err instanceof Error ? err.message : 'Failed to load events')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    const cursorForRequest = page === 1 ? null : (cursors[page - 2] ?? null)
    void fetchPage(page, cursorForRequest, appliedFilters)
  }, [page, appliedFilters, fetchPage])

  const hasPendingFilterChanges = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(appliedFilters),
    [filters, appliedFilters]
  )

  const applyFilters = () => {
    setAppliedFilters(filters)
    setPage(1)
    setCursors([null])
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(1)
    setCursors([null])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recent activity
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Latest events across the platform
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(prev => !prev)}
        >
          {showFilters ? 'Hide filters' : 'Filter events'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {showFilters ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="analytics-action">Action</Label>
              <Select
                value={filters.action || 'all'}
                onValueChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    action: value === 'all' ? '' : (value as AuditAction),
                  }))
                }
              >
                <SelectTrigger id="analytics-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ALL_AUDIT_ACTIONS.map(action => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analytics-source">Source</Label>
              <Select
                value={filters.source || 'all'}
                onValueChange={value =>
                  setFilters(prev => ({
                    ...prev,
                    source: value === 'all' ? '' : (value as AuditSource),
                  }))
                }
              >
                <SelectTrigger id="analytics-source">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {ALL_AUDIT_SOURCES.map(source => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analytics-actor">Actor UID</Label>
              <Input
                id="analytics-actor"
                value={filters.actorUid}
                onChange={e =>
                  setFilters(prev => ({ ...prev, actorUid: e.target.value }))
                }
                placeholder="Exact actor UID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analytics-target">Target UID</Label>
              <Input
                id="analytics-target"
                value={filters.targetUid}
                onChange={e =>
                  setFilters(prev => ({ ...prev, targetUid: e.target.value }))
                }
                placeholder="Exact target UID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analytics-match">Match ID</Label>
              <Input
                id="analytics-match"
                value={filters.matchId}
                onChange={e =>
                  setFilters(prev => ({ ...prev, matchId: e.target.value }))
                }
                placeholder="Exact match ID"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={applyFilters}
              disabled={!hasPendingFilterChanges}
            >
              Apply filters
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {loading && logs.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading events…</p>
      ) : logs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">
          No events match your filters.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <EventRow key={log.id} log={log} />
          ))}
        </div>
      )}

      {totalCount > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          itemLabel="events"
          onPrevious={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        />
      ) : null}
    </div>
  )
}
