/**
 * Typed feature-flag keys used with LaunchDarkly.
 * Keep keys kebab-case to match the LD dashboard (camelCase conversion disabled).
 */
export const FEATURE_FLAG_KEYS = ['pitch-lineup-view'] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

/** Fail-closed defaults when LD is unavailable or a flag is missing. */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  'pitch-lineup-view': false,
}
