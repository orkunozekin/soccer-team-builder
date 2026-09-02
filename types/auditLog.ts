export type AuditAction =
  | 'auth.login'
  | 'auth.register'
  | 'auth.login_failed'
  | 'auth.register_failed'
  | 'auth.password_reset_requested'
  | 'user.created'
  | 'user.profile_updated'
  | 'user.profile_update_failed'
  | 'user.role_changed'
  | 'user.role_change_failed'
  | 'user.deleted'
  | 'rsvp.confirmed'
  | 'rsvp.failed'
  | 'rsvp.cancelled'
  | 'rsvp.position_changed'
  | 'rsvp.impersonated'
  | 'check_in.geo'
  | 'check_in.failed'
  | 'check_in.host'
  | 'check_in.cleared'
  | 'match.created'
  | 'match.updated'
  | 'match.deleted'
  | 'match.rsvp_poll_toggled'
  | 'team.generated'
  | 'team.transferred'
  | 'team.rebalanced'
  | 'location.created'
  | 'location.updated'
  | 'location.deleted'
  | 'cron.rsvp_auto_opened'
  | 'cron.rsvp_auto_closed'
  | 'cron.audit_retention'

export type AuditSource = 'api' | 'client' | 'cron'

export type AuditEntityType =
  | 'user'
  | 'match'
  | 'rsvp'
  | 'team'
  | 'location'

export interface AuditLogInput {
  action: AuditAction
  actorUid: string
  actorRole?: string
  targetUid?: string
  matchId?: string
  entityType?: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
  source: AuditSource
}

export interface AuditLogFirestore {
  action: AuditAction
  actorUid: string
  actorRole?: string
  targetUid?: string
  matchId?: string
  entityType?: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
  source: AuditSource
  createdAt: unknown // Firestore Timestamp
}

export interface AuditLog extends Omit<AuditLogFirestore, 'createdAt'> {
  id: string
  createdAt: string
  /** Resolved at read time from the users collection; not stored on the log. */
  actorDisplayName?: string
  /** Resolved at read time from the users collection; not stored on the log. */
  targetDisplayName?: string
}

export interface AuditLogFilters {
  action?: AuditAction | ''
  source?: AuditSource | ''
  actorUid?: string
  targetUid?: string
  matchId?: string
  /** Inclusive lower bound on createdAt (ISO date or Date). */
  since?: Date | string
}

export const ALL_AUDIT_ACTIONS: readonly AuditAction[] = [
  'auth.login',
  'auth.register',
  'auth.login_failed',
  'auth.register_failed',
  'auth.password_reset_requested',
  'user.created',
  'user.profile_updated',
  'user.profile_update_failed',
  'user.role_changed',
  'user.role_change_failed',
  'user.deleted',
  'rsvp.confirmed',
  'rsvp.failed',
  'rsvp.cancelled',
  'rsvp.position_changed',
  'rsvp.impersonated',
  'check_in.geo',
  'check_in.failed',
  'check_in.host',
  'check_in.cleared',
  'match.created',
  'match.updated',
  'match.deleted',
  'match.rsvp_poll_toggled',
  'team.generated',
  'team.transferred',
  'team.rebalanced',
  'location.created',
  'location.updated',
  'location.deleted',
  'cron.rsvp_auto_opened',
  'cron.rsvp_auto_closed',
  'cron.audit_retention',
] as const

export const ALL_AUDIT_SOURCES: readonly AuditSource[] = [
  'api',
  'client',
  'cron',
] as const

/** Actions that authenticated clients may record via POST /api/audit */
export const CLIENT_AUDIT_ACTIONS: readonly AuditAction[] = [
  'auth.login',
  'auth.register',
  'auth.login_failed',
  'auth.register_failed',
  'user.created',
] as const
