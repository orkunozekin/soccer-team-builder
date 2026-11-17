import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CreateMatchCard } from '@/components/admin/CreateMatchCard'

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ userData: { activeClubId: 'club-1' } }),
}))
vi.mock('@/lib/api/client', () => ({ createMatchAPI: vi.fn() }))
vi.mock('@/lib/services/matchService', () => ({ getMatch: vi.fn() }))
vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => ({ addMatch: vi.fn() }),
}))
vi.mock('@/components/admin/LocationPicker', () => ({
  LocationPicker: () => null,
}))

const originalTz = process.env.TZ

beforeEach(() => {
  // Evening in a US time zone, when the UTC date has already rolled over.
  process.env.TZ = 'America/Los_Angeles'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 17, 21, 0))
})

afterEach(() => {
  vi.useRealTimers()
  process.env.TZ = originalTz
})

test('allows picking today in the evening when UTC is already tomorrow', async () => {
  expect(new Date().toISOString().startsWith('2026-11-18')).toBe(true)

  const user = userEvent.setup()
  render(<CreateMatchCard clubId="club-1" />)

  await user.click(screen.getByRole('button', { name: 'Add match' }))
  await user.click(screen.getByRole('button', { name: 'Date' }))

  const today = screen.getByRole('button', { name: /november 17th, 2026/i })
  expect(today).toBeEnabled()
  expect(
    screen.getByRole('button', { name: /november 16th, 2026/i })
  ).toBeDisabled()
})
