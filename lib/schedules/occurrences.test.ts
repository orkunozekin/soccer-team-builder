import { describe, expect, it } from 'vitest'
import {
  buildOccurrenceKey,
  ctWeekday,
  generateOccurrences,
} from './occurrences'
import { SCHEDULE_TIMEZONE } from '@/types/schedule'
import type { MatchSchedule } from '@/types/schedule'

function baseSchedule(
  overrides: Partial<MatchSchedule> = {}
): MatchSchedule {
  return {
    id: 'sched_1',
    name: 'Club nights',
    cadence: 'weekly',
    interval: 1,
    timezone: SCHEDULE_TIMEZONE,
    slots: [
      {
        id: 'slot_mon',
        day: 1, // Monday
        time: '19:00',
        location: {
          name: 'Park A',
          address: '1 A St',
          lat: null,
          lng: null,
        },
      },
      {
        id: 'slot_wed',
        day: 3, // Wednesday
        time: '19:00',
        location: {
          name: 'Park B',
          address: '2 B St',
          lat: null,
          lng: null,
        },
      },
      {
        id: 'slot_sun',
        day: 0, // Sunday
        time: '10:00',
        location: {
          name: 'Park C',
          address: '3 C St',
          lat: null,
          lng: null,
        },
      },
    ],
    active: true,
    // Monday 2024-03-04 CT
    createdAt: new Date('2024-03-04T18:00:00.000Z'),
    updatedAt: new Date('2024-03-04T18:00:00.000Z'),
    createdBy: 'admin1',
    ...overrides,
  }
}

describe('generateOccurrences', () => {
  it('buildOccurrenceKey is stable', () => {
    expect(buildOccurrenceKey('s', 'slot', '2024-03-11')).toBe(
      's:slot:2024-03-11'
    )
  })

  it('returns next Mon/Wed/Sun in chronological order', () => {
    // Thursday 2024-03-07 12:00 CT = 17:00Z (CST)
    const from = new Date('2024-03-07T18:00:00.000Z')
    const occ = generateOccurrences(baseSchedule(), from, 3)

    expect(occ).toHaveLength(3)
    expect(occ.map(o => o.ymd)).toEqual([
      '2024-03-10', // Sun
      '2024-03-11', // Mon
      '2024-03-13', // Wed
    ])
    expect(occ[0].slotId).toBe('slot_sun')
    expect(occ[0].time).toBe('10:00')
    expect(occ[1].slotId).toBe('slot_mon')
    expect(occ[2].slotId).toBe('slot_wed')
    expect(occ[0].occurrenceKey).toBe('sched_1:slot_sun:2024-03-10')
  })

  it('skips occurrences whose kickoff is before from', () => {
    // Monday 2024-03-11 after 19:00 CT kickoff
    const from = new Date('2024-03-12T01:30:00.000Z') // 19:30 CT on Mar 11
    const occ = generateOccurrences(baseSchedule(), from, 2)
    expect(occ[0].ymd).toBe('2024-03-13')
    expect(occ[0].slotId).toBe('slot_wed')
  })

  it('respects weekly interval of 2', () => {
    const schedule = baseSchedule({ interval: 2 })
    // Anchor week is week of 2024-03-04 (on). Off-week Mar 10-16; on again Mar 17+.
    const from = new Date('2024-03-05T18:00:00.000Z')
    const occ = generateOccurrences(schedule, from, 3)
    expect(occ.map(o => o.ymd)).toEqual([
      '2024-03-06', // Wed still in anchor on-week
      '2024-03-17', // Sun on-week
      '2024-03-18', // Mon on-week
    ])
  })

  it('generates monthly day-of-month occurrences', () => {
    const schedule = baseSchedule({
      cadence: 'monthly',
      slots: [
        {
          id: 'slot_1st',
          day: 1,
          time: '09:00',
          location: null,
        },
        {
          id: 'slot_15th',
          day: 15,
          time: '18:00',
          location: null,
        },
      ],
      createdAt: new Date('2024-01-01T18:00:00.000Z'),
    })
    const from = new Date('2024-03-02T18:00:00.000Z')
    const occ = generateOccurrences(schedule, from, 3)
    expect(occ.map(o => `${o.ymd}@${o.time}`)).toEqual([
      '2024-03-15@18:00',
      '2024-04-01@09:00',
      '2024-04-15@18:00',
    ])
  })

  it('ctWeekday uses America/Chicago', () => {
    // 2024-03-10 is Sunday in CT
    const sunday = new Date('2024-03-10T17:00:00.000Z')
    expect(ctWeekday(sunday, SCHEDULE_TIMEZONE)).toBe(0)
  })
})
