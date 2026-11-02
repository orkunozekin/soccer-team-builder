import { describe, expect, it } from 'vitest'
import {
  getKickoffLabel,
  getKickoffLabelForMatch,
  getMatchRsvpStatus,
} from './matchStatus'

const now = new Date(2026, 10, 3, 12, 0)
const later = new Date(2026, 10, 3, 17, 0)
const earlier = new Date(2026, 10, 3, 6, 0)

describe('getMatchRsvpStatus', () => {
  it('shows the close time while RSVP is open', () => {
    expect(
      getMatchRsvpStatus({
        rsvpOpen: true,
        opensAt: earlier,
        closesAt: later,
        now,
      })
    ).toEqual({ tone: 'live', label: 'RSVP open · closes 5:00 PM CT' })
  })

  it('omits the close time once it has passed', () => {
    expect(
      getMatchRsvpStatus({
        rsvpOpen: true,
        opensAt: null,
        closesAt: earlier,
        now,
      })
    ).toEqual({ tone: 'live', label: 'RSVP open' })
  })

  it('announces when a closed poll will open', () => {
    expect(
      getMatchRsvpStatus({
        rsvpOpen: false,
        opensAt: later,
        closesAt: null,
        now,
      })
    ).toEqual({ tone: 'neutral', label: 'RSVP opens Tue Nov 3 at 5:00 PM CT' })
  })

  it('reads as closed when no future open time exists', () => {
    expect(
      getMatchRsvpStatus({
        rsvpOpen: false,
        opensAt: earlier,
        closesAt: null,
        now,
      })
    ).toEqual({ tone: 'muted', label: 'RSVP closed' })
  })
})

describe('getKickoffLabel', () => {
  it('counts down to kickoff', () => {
    expect(getKickoffLabel(new Date(2026, 10, 6, 12, 0), now)).toBe('in 3 days')
  })

  it('reports kicked off at and after the start time', () => {
    expect(getKickoffLabel(now, now)).toBe('Kicked off')
    expect(getKickoffLabel(earlier, now)).toBe('Kicked off')
  })
})

describe('getKickoffLabelForMatch', () => {
  it('counts down to the scheduled CT kickoff, not the stored date time', () => {
    const match = { date: new Date('2030-01-10T18:00:00Z'), time: '19:30' }
    // 19:30 CT on Jan 10 is 01:30Z on Jan 11.
    expect(
      getKickoffLabelForMatch(match, new Date('2030-01-11T00:30:00Z'))
    ).toBe('in 1 hour')
  })
})
