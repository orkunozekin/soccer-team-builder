'use client'

import * as React from 'react'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface TimePickerProps {
  value: string
  onChange: (time: string) => void
  id?: string
  disabled?: boolean
  /** Step in seconds (default 300 = 5 min) */
  step?: number
  className?: string
  placeholder?: string
}

/** Normalize to HH:mm for select values. */
export function normalizeTimeValue(time: string): string {
  if (!time) return ''
  const [hRaw, mRaw] = time.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function buildTimeOptions(
  stepSeconds = 300
): { value: string; label: string }[] {
  const stepMinutes = Math.max(1, Math.round(stepSeconds / 60))
  const options: { value: string; label: string }[] = []
  for (let mins = 0; mins < 24 * 60; mins += stepMinutes) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    options.push({
      value,
      label: format(new Date(2000, 0, 1, h, m), 'h:mm a'),
    })
  }
  return options
}

export function TimePicker({
  value,
  onChange,
  id,
  disabled = false,
  step = 300,
  className,
  placeholder = 'Select time',
}: TimePickerProps) {
  const options = React.useMemo(() => buildTimeOptions(step), [step])
  const normalized = normalizeTimeValue(value)

  const optionsWithValue = React.useMemo(() => {
    if (!normalized || options.some(opt => opt.value === normalized)) {
      return options
    }
    const [h, m] = normalized.split(':').map(Number)
    return [
      ...options,
      {
        value: normalized,
        label: format(new Date(2000, 0, 1, h, m), 'h:mm a'),
      },
    ].sort((a, b) => a.value.localeCompare(b.value))
  }, [normalized, options])

  return (
    <Select
      value={normalized || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn(
          'h-11 w-full min-w-0 max-w-full bg-background text-base font-normal sm:h-9 sm:text-sm',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {optionsWithValue.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
