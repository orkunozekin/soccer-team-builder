const HOUR_MS = 60 * 60 * 1000

/** Every new invite expires this long after it is created. */
export const INVITE_TTL_MS = 12 * HOUR_MS

/**
 * Players may create one invite per club per this window. Shorter than the TTL
 * so a player's next code can be made before the current one stops working.
 */
export const PLAYER_INVITE_COOLDOWN_MS = 11 * HOUR_MS

export const PLAYER_INVITE_LIMIT_MESSAGE =
  'You can create one invite every 11 hours.'
