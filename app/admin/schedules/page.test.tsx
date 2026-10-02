import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import AdminSchedulesPage from './page'
import type { ScheduleFormValues } from '@/components/admin/ScheduleForm'
import { listSchedulesAPI, updateScheduleAPI } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  listSchedulesAPI: vi.fn(),
  updateScheduleAPI: vi.fn(),
  createScheduleAPI: vi.fn(),
  deleteScheduleAPI: vi.fn(),
}))
vi.mock('@/components/admin/ScheduleForm', () => ({
  ScheduleForm: ({
    onSubmit,
  }: {
    onSubmit: (values: ScheduleFormValues) => Promise<void>
  }) => (
    <button
      onClick={() =>
        onSubmit({
          name: 'A renamed schedule',
          cadence: 'weekly',
          interval: 1,
          active: true,
          slots: [],
        })
      }
    >
      Save test schedule
    </button>
  ),
}))

it('paginates schedules and keeps a renamed schedule visible after saving', async () => {
  const schedules = Array.from({ length: 11 }, (_, i) => ({
    id: `${i}`,
    name: `Schedule ${i}`,
    cadence: 'weekly' as const,
    interval: 1,
    timezone: 'America/Chicago',
    slots: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
  }))
  vi.mocked(listSchedulesAPI).mockResolvedValueOnce({
    schedules,
  })
  const user = userEvent.setup()
  render(<AdminSchedulesPage />)
  expect(await screen.findByText('Schedule 0')).toBeInTheDocument()
  expect(screen.queryByText('Schedule 10')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByText('Schedule 10')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  const renamed = { ...schedules[10], name: 'A renamed schedule' }
  vi.mocked(updateScheduleAPI).mockResolvedValueOnce({
    success: true,
    schedule: renamed,
  })
  vi.mocked(listSchedulesAPI).mockResolvedValueOnce({
    schedules: [renamed, ...schedules.slice(0, 10)],
  })
  await user.click(screen.getByRole('button', { name: 'Save test schedule' }))
  expect(await screen.findByText('A renamed schedule')).toBeInTheDocument()
  expect(screen.getByText('Showing 1–10 of 11 schedules')).toBeInTheDocument()
})
