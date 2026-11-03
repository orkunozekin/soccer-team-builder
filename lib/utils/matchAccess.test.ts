import { describe, expect, it } from 'vitest'
import { isMatchReadOnly } from './matchAccess'

// 19:30 CT on Jan 10 2030 is 01:30Z on Jan 11; the RSVP window closes 4h later.
const match = { date: new Date('2030-01-10T18:00:00Z'), time: '19:30' }
const beforeClose = new Date('2030-01-11T05:00:00Z')
const afterClose = new Date('2030-01-11T06:00:00Z')

describe('isMatchReadOnly', () => {
  it('keeps upcoming and in-progress matches interactive', () => {
    expect(isMatchReadOnly(match, false, beforeClose)).toBe(false)
  })

  it('makes past matches read-only for players', () => {
    expect(isMatchReadOnly(match, false, afterClose)).toBe(true)
  })

  it('never locks past matches for people who manage the club', () => {
    expect(isMatchReadOnly(match, true, afterClose)).toBe(false)
  })
})
