/**
 * Typed feature-flag keys used with LaunchDarkly.
 * Keep keys kebab-case to match the LD dashboard (camelCase conversion disabled).
 */
export const FEATURE_FLAG_KEYS = [
  'pitch-lineup-view',
  'club-creation',
] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

/** Fail-closed defaults when LD is unavailable or a flag is missing. */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  'pitch-lineup-view': false,
  'club-creation': false,
}

/**
 * Optional local overrides (no LD client required).
 * Set NEXT_PUBLIC_FF_* =true in .env.local for local demos.
 */
export function getLocalFeatureFlagOverrides(): Partial<
  Record<FeatureFlagKey, boolean>
> {
  const overrides: Partial<Record<FeatureFlagKey, boolean>> = {}
  if (process.env.NEXT_PUBLIC_FF_PITCH_LINEUP_VIEW === 'true') {
    overrides['pitch-lineup-view'] = true
  }
  if (process.env.NEXT_PUBLIC_FF_CLUB_CREATION === 'true') {
    overrides['club-creation'] = true
  }
  return overrides
}
