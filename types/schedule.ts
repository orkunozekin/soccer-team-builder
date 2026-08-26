import type { MatchLocation } from '@/types/match'

export type ScheduleCadence = 'weekly' | 'monthly'

export interface ScheduleSlot {
  id: string
  /** weekly: 0=Sun ... 6=Sat; monthly: day of month 1-28 */
  day: number
  time: string // HH:mm
  location: MatchLocation | null
}

export interface MatchSchedule {
  id: string
  name: string
  cadence: ScheduleCadence
  /** Every N weeks/months; default 1 */
  interval: number
  timezone: string
  slots: ScheduleSlot[]
  active: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export const SCHEDULE_TIMEZONE = 'America/Chicago'
export const SCHEDULE_LOOKAHEAD = 3
