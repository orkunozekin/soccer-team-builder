import { describe, expect, it } from 'vitest'
import {
  ADMIN_USER_FILTERS,
  matchesAdminUserFilter,
} from './adminUserFilters'

describe('matchesAdminUserFilter', () => {
  const clubAdmins = new Set(['admin-1', 'admin-2'])

  it('matches club admins by membership set, not platform role', () => {
    expect(
      matchesAdminUserFilter(
        { uid: 'admin-1', role: 'user' },
        'club_admins',
        clubAdmins
      )
    ).toBe(true)
    expect(
      matchesAdminUserFilter(
        { uid: 'other', role: 'super_user' },
        'club_admins',
        clubAdmins
      )
    ).toBe(false)
  })

  it('matches platform super users and regular users by role', () => {
    expect(
      matchesAdminUserFilter(
        { uid: 's1', role: 'super_user' },
        'super_users',
        clubAdmins
      )
    ).toBe(true)
    expect(
      matchesAdminUserFilter(
        { uid: 'u1', role: 'user' },
        'super_users',
        clubAdmins
      )
    ).toBe(false)
    expect(
      matchesAdminUserFilter(
        { uid: 'u1', role: 'user' },
        'users',
        clubAdmins
      )
    ).toBe(true)
    expect(
      matchesAdminUserFilter(
        { uid: 's1', role: 'super_user' },
        'users',
        clubAdmins
      )
    ).toBe(false)
  })

  it('exposes the three requested role options', () => {
    expect(ADMIN_USER_FILTERS.map(f => f.label)).toEqual([
      'Club admins',
      'Super users',
      'Users',
    ])
  })
})
