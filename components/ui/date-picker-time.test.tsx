import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DatePickerTime } from '@/components/ui/date-picker-time'

test('renders custom time select instead of native time input', () => {
  render(
    <DatePickerTime
      date="2026-09-07"
      time="09:00"
      onDateChange={vi.fn()}
      onTimeChange={vi.fn()}
    />
  )

  expect(document.querySelector('input[type="time"]')).toBeNull()
  expect(screen.getByRole('combobox', { name: /time/i })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /time/i })).toHaveTextContent(
    '9:00 AM'
  )
})

test('time control uses full width classes', () => {
  render(
    <DatePickerTime
      date=""
      time="19:00"
      onDateChange={vi.fn()}
      onTimeChange={vi.fn()}
    />
  )

  const timeControl = screen.getByRole('combobox', { name: /time/i })
  expect(timeControl.className).toMatch(/\bw-full\b/)
  expect(timeControl.className).toMatch(/\bmin-w-0\b/)
  expect(timeControl.className).toMatch(/\bmax-w-full\b/)
})
