'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ScheduleForm,
  type ScheduleFormValues,
} from '@/components/admin/ScheduleForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import {
  createScheduleAPI,
  deleteScheduleAPI,
  listSchedulesAPI,
  updateScheduleAPI,
} from '@/lib/api/client'
import {
  LIST_PAGE_SIZE,
  useClientPagination,
} from '@/lib/hooks/useClientPagination'
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
          ? (WEEKDAY_LABELS[s.day] ?? `Day ${s.day}`)
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
  const paged = useClientPagination(schedules)
  const { setPage } = paged
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing] = useState<MatchSchedule | null>(null)
  const [actionError, setActionError] = useState('')

  const refresh = useCallback(
    async (focusId?: string) => {
      setLoading(true)
      setActionError('')
      try {
        const { schedules: list } = await listSchedulesAPI()
        setSchedules(list.map(serializeDates))
        if (focusId) {
          const index = list.findIndex(item => item.id === focusId)
          if (index >= 0) setPage(Math.floor(index / LIST_PAGE_SIZE) + 1)
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to load schedules'
        )
      } finally {
        setLoading(false)
      }
    },
    [setPage]
  )

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
    const editedId = editing.id
    await updateScheduleAPI(editedId, values)
    setEditing(null)
    setMode('list')
    await refresh(editedId)
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
      <PageHeader
        eyebrow="Super user"
        title="Schedules"
        description="Recurring weekly or monthly match templates. Active schedules keep the next 3 matches visible for players."
        actions={
          mode === 'list' ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setMode('create')
              }}
            >
              New schedule
            </Button>
          ) : null
        }
      />

      {actionError && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      {mode === 'create' && (
        <section
          aria-labelledby="schedule-form-heading"
          className="mb-8 space-y-4"
        >
          <div className="space-y-1">
            <h2
              id="schedule-form-heading"
              className="font-display text-2xl font-extrabold uppercase"
            >
              Create schedule
            </h2>
            <p className="text-sm text-fog">
              Add one or more day/time/location slots. Activate to create the
              next 3 matches immediately.
            </p>
          </div>
          <ScheduleForm
            submitLabel="Create schedule"
            onSubmit={handleCreate}
            onCancel={() => setMode('list')}
          />
        </section>
      )}

      {mode === 'edit' && editing && (
        <section
          aria-labelledby="schedule-form-heading"
          className="mb-8 space-y-4"
        >
          <div className="space-y-1">
            <h2
              id="schedule-form-heading"
              className="font-display text-2xl font-extrabold uppercase"
            >
              Edit schedule
            </h2>
            <p className="text-sm text-fog">
              Changes apply to future generated matches only.
            </p>
          </div>
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
        </section>
      )}

      {mode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading schedules…</p>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No schedules yet. Create one to auto-generate recurring matches.
              </CardContent>
            </Card>
          ) : (
            paged.items.map(schedule => (
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
                          <span className="font-medium text-success-bright">
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
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDelete(schedule)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {summarizeSlots(schedule) || 'No slots'}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
          {!loading && paged.pagination.totalPages > 1 && (
            <Pagination {...paged.pagination} itemLabel="schedules" />
          )}
        </div>
      )}
    </div>
  )
}
