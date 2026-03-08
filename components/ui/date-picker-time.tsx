'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DatePickerTimeProps {
  /** Date as YYYY-MM-DD */
  date: string
  /** Time as HH:mm or HH:mm:ss */
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  datePlaceholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
  dateId?: string
  timeId?: string
  /** Time input step in seconds (default 300 = 5 min) */
  timeStep?: number
}

export function DatePickerTime({
  date,
  time,
  onDateChange,
  onTimeChange,
  datePlaceholder = 'Select date',
  disabled = false,
  minDate,
  className,
  dateId = 'date-picker',
  timeId = 'time-picker',
  timeStep = 300,
}: DatePickerTimeProps) {
  const [open, setOpen] = React.useState(false)
  const dateObj = date ? new Date(date + 'T12:00:00') : undefined
  const min = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
    : undefined

  return (
    <FieldGroup className={cn('flex-row flex-wrap gap-4', className)}>
      <Field className="w-full sm:w-[14rem]">
        <FieldLabel htmlFor={dateId}>Date</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id={dateId}
              disabled={disabled}
              className="h-11 w-full min-w-[8rem] justify-between text-base font-normal sm:h-9 sm:text-sm"
            >
              {dateObj ? format(dateObj, 'PPP') : datePlaceholder}
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={dateObj}
              captionLayout="dropdown"
              defaultMonth={dateObj}
              hideNavigation
              disabled={min ? day => day < min : undefined}
              onSelect={d => {
                onDateChange(d ? format(d, 'yyyy-MM-dd') : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-full sm:w-[14rem]">
        <FieldLabel htmlFor={timeId}>Time</FieldLabel>
        <Input
          type="time"
          id={timeId}
          step={timeStep}
          value={time}
          onChange={e => onTimeChange(e.target.value)}
          disabled={disabled}
          className="h-11 w-full bg-background text-base sm:h-9 sm:text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </Field>
    </FieldGroup>
  )
}
