'use client'

import { MatchAttendanceList } from '@/components/matches/MatchAttendanceList'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

interface HostAttendancePanelProps {
  match: Match
  rsvps: RSVP[]
  users: User[]
  onUpdated?: () => void | Promise<void>
}

/** Admin wrapper around the shared check-in status list with host override actions. */
export function HostAttendancePanel({
  match,
  rsvps,
  users,
  onUpdated,
}: HostAttendancePanelProps) {
  return (
    <MatchAttendanceList
      match={match}
      rsvps={rsvps}
      users={users}
      canHostOverride
      onUpdated={onUpdated}
    />
  )
}
