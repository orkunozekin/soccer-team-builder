'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminNav } from '@/components/admin/AdminNav'
import {
  ScheduleForm,
  type ScheduleFormValues,
} from '@/components/admin/ScheduleForm'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  createScheduleAPI,
  deleteScheduleAPI,
  listSchedulesAPI,
  updateScheduleAPI,
} from '@/lib/api/client'
import type { MatchSchedule } from '@/types/schedule'

const WEEKDAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const

function summarizeSlots(schedule: MatchSchedule): string {
  return schedule.slots
    .map(s => {
      const dayLabel =
        schedule.cadence === 'weekly'
          ? WEEKDAY_LABELS[s.day] ?? `Day ${s.day}`
          : `Day ${s.day}`
      const loc = s.location?.name ? ` @ ${s.location.name}` : ''
      return `${dayLabel} ${s.time}${loc}`
    })
    .join(' · ')
}

function serializeDates(schedule: MatchSchedule): MatchSchedule {
  return {
    ...schedule,
    createdAt: new Date(schedule.createdAt),
    updatedAt: new Date(schedule.updatedAt),
  }
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<MatchSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing] = useState<MatchSchedule | null>(null)
  const [actionError, setActionError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setActionError('')
    try {
      const { schedules: list } = await listSchedulesAPI()
      setSchedules(list.map(serializeDates))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to load schedules'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleCreate = async (values: ScheduleFormValues) => {
    await createScheduleAPI(values)
    setMode('list')
    await refresh()
  }

  const handleUpdate = async (values: ScheduleFormValues) => {
    if (!editing) return
    await updateScheduleAPI(editing.id, values)
    setEditing(null)
    setMode('list')
    await refresh()
  }

  const handleToggleActive = async (schedule: MatchSchedule) => {
    setActionError('')
    try {
      await updateScheduleAPI(schedule.id, { active: !schedule.active })
      await refresh()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update schedule'
      )
    }
  }

  const handleDelete = async (schedule: MatchSchedule) => {
    if (
      !window.confirm(
        `Delete schedule "${schedule.name}"? Existing matches will not be deleted.`
      )
    ) {
      return
    }
    setActionError('')
    try {
      await deleteScheduleAPI(schedule.id)
      await refresh()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete schedule'
      )
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <AdminNav />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Schedules
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Recurring weekly or monthly match templates. Active schedules keep
            the next 3 matches visible for players.
          </p>
        </div>
        {mode === 'list' && (
          <Button
            type="button"
            onClick={() => {
              setEditing(null)
              setMode('create')
            }}
          >
            New schedule
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </p>
      )}

      {mode === 'create' && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create schedule</CardTitle>
            <CardDescription>
              Add one or more day/time/location slots. Activate to create the
              next 3 matches immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              submitLabel="Create schedule"
              onSubmit={handleCreate}
              onCancel={() => setMode('list')}
            />
          </CardContent>
        </Card>
      )}

      {mode === 'edit' && editing && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Edit schedule</CardTitle>
            <CardDescription>
              Changes apply to future generated matches only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              key={editing.id}
              initial={editing}
              submitLabel="Save changes"
              onSubmit={handleUpdate}
              onCancel={() => {
                setEditing(null)
                setMode('list')
              }}
            />
          </CardContent>
        </Card>
      )}

      {mode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading schedules…</p>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No schedules yet. Create one to auto-generate recurring matches.
              </CardContent>
            </Card>
          ) : (
            schedules.map(schedule => (
              <Card key={schedule.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{schedule.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {schedule.cadence === 'weekly' ? 'Weekly' : 'Monthly'}
                        {schedule.interval > 1
                          ? ` (every ${schedule.interval})`
                          : ''}
                        {' · '}
                        {schedule.active ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span>Inactive</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleToggleActive(schedule)}
                      >
                        {schedule.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(schedule)
                          setMode('edit')
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(schedule)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {summarizeSlots(schedule) || 'No slots'}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
