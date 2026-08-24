'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { CardLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  ALL_AUDIT_ACTIONS,
  ALL_AUDIT_SOURCES,
  type AuditAction,
  type AuditLog,
  type AuditSource,
} from '@/types/auditLog'

const PAGE_SIZE = 25

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

function actionBadgeVariant(
  action: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (action.startsWith('user.deleted') || action.startsWith('match.deleted')) {
    return 'destructive'
  }
  if (action.startsWith('auth.') || action.startsWith('cron.')) {
    return 'secondary'
  }
  return 'outline'
}

function UserLink({ uid, label }: { uid: string; label?: string }) {
  if (uid === 'system' || uid === 'anonymous') {
    return <span className="font-mono text-xs text-zinc-500">{uid}</span>
  }
  return (
    <Link
      href={`/admin/players/${uid}`}
      className="font-mono text-xs text-red-700 hover:underline dark:text-red-400"
    >
      {label ?? uid.slice(0, 8)}
    </Link>
  )
}

function AnalyticsEventRow({ log }: { log: AuditLog }) {
  const hasMetadata =
    log.metadata != null && Object.keys(log.metadata).length > 0

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionBadgeVariant(log.action)}>
              {formatAction(log.action)}
            </Badge>
            <Badge variant="secondary">{log.source}</Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {format(new Date(log.createdAt), 'MMM d, yyyy · h:mm:ss a')}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Actor</dt>
          <dd>
            <UserLink uid={log.actorUid} />
            {log.actorRole ? (
              <span className="ml-2 text-xs text-zinc-500">({log.actorRole})</span>
            ) : null}
          </dd>
        </div>
        {log.targetUid ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Target user
            </dt>
            <dd>
              <UserLink uid={log.targetUid} />
            </dd>
          </div>
        ) : null}
        {log.matchId ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Match</dt>
            <dd>
              <Link
                href={`/admin/matches/${log.matchId}`}
                className="font-mono text-xs text-red-700 hover:underline dark:text-red-400"
              >
                {log.matchId}
              </Link>
            </dd>
          </div>
        ) : null}
        {log.entityType ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              Entity
            </dt>
            <dd className="font-mono text-xs">
              {log.entityType}
              {log.entityId ? ` · ${log.entityId}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {hasMetadata ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Metadata
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900/50">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  )
}

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS)
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
        setError(
          err instanceof Error ? err.message : 'Failed to load analytics'
        )
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

  if (loading && logs.length === 0 && !error) {
    return <CardLoadingSkeleton />
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        ) : null}

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

          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={applyFilters}
            disabled={!hasPendingFilterChanges}
          >
            Apply filters
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading analytics…</p>
        ) : logs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">
            No events match your filters.
          </p>
        ) : (
          <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {logs.map(log => (
              <AnalyticsEventRow key={log.id} log={log} />
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
      </CardContent>
    </Card>
  )
}
