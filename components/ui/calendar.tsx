'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, UI, DayFlag, SelectionState } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        [UI.Root]: 'space-y-4',
        [UI.Months]: 'flex flex-col sm:flex-row sm:space-x-4 sm:space-y-0',
        [UI.Month]: 'space-y-4',
        [UI.MonthCaption]: 'flex justify-center pt-1 relative items-center min-h-9 gap-2',
        [UI.CaptionLabel]: 'text-sm font-medium [.rdp-dropdown-root_&]:hidden',
        [UI.Nav]: 'space-x-1 flex items-center',
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1'
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1'
        ),
        [UI.Dropdowns]: 'flex gap-2 items-center justify-center flex-wrap',
        [UI.DropdownRoot]: 'relative rdp-dropdown-root',
        [UI.Dropdown]: 'rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:focus-visible:ring-zinc-300',
        [UI.MonthsDropdown]: 'min-w-[5rem]',
        [UI.YearsDropdown]: 'min-w-[4rem]',
        [UI.MonthGrid]: 'w-full border-collapse space-y-1',
        [UI.Weekdays]: 'flex',
        [UI.Weekday]:
          'text-zinc-500 rounded-md w-8 font-normal text-[0.8rem] dark:text-zinc-400',
        [UI.Weeks]: 'flex flex-col gap-2 mt-2',
        [UI.Week]: 'flex w-full',
        [UI.Day]: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-md',
        [UI.DayButton]: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
        ),
        [SelectionState.selected]:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        [DayFlag.today]: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50',
        [DayFlag.outside]:
          'text-zinc-500 opacity-50 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-500 dark:text-zinc-400 dark:aria-selected:bg-zinc-800/50 dark:aria-selected:text-zinc-400',
        [DayFlag.disabled]: 'text-zinc-500 opacity-50 dark:text-zinc-400',
        [SelectionState.range_middle]:
          'aria-selected:bg-zinc-100 aria-selected:text-zinc-900 dark:aria-selected:bg-zinc-800 dark:aria-selected:text-zinc-50',
        [DayFlag.hidden]: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
