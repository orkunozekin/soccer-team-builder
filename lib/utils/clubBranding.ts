import { z } from 'zod'
import type { ClubBranding } from '@/types/club'

/** Soccerville red used when a club has no primary color. */
export const PLATFORM_CHROME_BACKGROUND = '#CC0000'
export const PLATFORM_CHROME_FOREGROUND = '#ffffff'

export const CLUB_DISPLAY_NAME_MAX = 80
export const CLUB_LOGO_URL_MAX = 2048

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

/** `null` clears a stored field. Omitted keys stay as they are. */
export type ClubBrandingPatch = {
  displayName?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
}

type FieldResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

export type ClubBrandingParseResult =
  | { ok: true; patch: ClubBrandingPatch | undefined }
  | { ok: false; error: string }

export type ClubChromeStyle = {
  '--club-primary': string
  '--club-foreground': string
  backgroundColor: 'var(--club-primary)'
  color: 'var(--club-foreground)'
}

export const clubChromeFgClass = 'text-[var(--club-foreground)]'
export const clubChromeBorderClass =
  'border-[color:color-mix(in_srgb,var(--club-foreground)_35%,transparent)]'
export const clubChromeFillClass =
  'bg-[color:color-mix(in_srgb,var(--club-foreground)_12%,transparent)]'
export const clubChromeHoverClass =
  'hover:bg-[color:color-mix(in_srgb,var(--club-foreground)_12%,transparent)]'
export const clubChromeEdgeClass =
  'border-[color:color-mix(in_srgb,var(--club-primary)_70%,black)]'

function hasBranding(branding: ClubBranding): boolean {
  return Boolean(
    branding.displayName || branding.logoUrl || branding.primaryColor
  )
}

export function parseDisplayName(raw: unknown): FieldResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Display name is invalid' }
  }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > CLUB_DISPLAY_NAME_MAX) {
    return {
      ok: false,
      error: `Display name must be ${CLUB_DISPLAY_NAME_MAX} characters or fewer`,
    }
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, error: 'Display name is invalid' }
  }
  return { ok: true, value: trimmed }
}

export function parseLogoUrl(raw: unknown): FieldResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Logo URL must be an https URL' }
  }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > CLUB_LOGO_URL_MAX || /\s/.test(trimmed)) {
    return { ok: false, error: 'Logo URL must be an https URL' }
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Logo URL must be an https URL' }
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    return { ok: false, error: 'Logo URL must be an https URL' }
  }
  return { ok: true, value: url.href }
}

export function parsePrimaryColor(raw: unknown): FieldResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Primary color must be a #rrggbb hex color' }
  }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!HEX_COLOR.test(trimmed)) {
    return { ok: false, error: 'Primary color must be a #rrggbb hex color' }
  }
  return { ok: true, value: trimmed.toLowerCase() }
}

function assignField(
  patch: ClubBrandingPatch,
  key: keyof ClubBrandingPatch,
  raw: unknown,
  parse: (value: unknown) => FieldResult
): string | null {
  if (raw === null) {
    patch[key] = null
    return null
  }
  const parsed = parse(raw)
  if (!parsed.ok) return parsed.error
  patch[key] = parsed.value
  return null
}

/**
 * Validate a branding object from `PATCH /api/clubs/:id`.
 * Missing input is not an update. Empty strings clear that field.
 */
export function parseClubBrandingInput(raw: unknown): ClubBrandingParseResult {
  if (raw === undefined) return { ok: true, patch: undefined }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid club branding' }
  }

  const record = raw as Record<string, unknown>
  const patch: ClubBrandingPatch = {}

  if ('displayName' in record) {
    const error = assignField(
      patch,
      'displayName',
      record.displayName,
      parseDisplayName
    )
    if (error) return { ok: false, error }
  }
  if ('logoUrl' in record) {
    const error = assignField(patch, 'logoUrl', record.logoUrl, parseLogoUrl)
    if (error) return { ok: false, error }
  }
  if ('primaryColor' in record) {
    const error = assignField(
      patch,
      'primaryColor',
      record.primaryColor,
      parsePrimaryColor
    )
    if (error) return { ok: false, error }
  }

  return { ok: true, patch }
}

function fieldSchema(parse: (raw: unknown) => FieldResult) {
  return z.string().superRefine((value, ctx) => {
    const parsed = parse(value)
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error })
    }
  })
}

export const clubBrandingFormSchema = z.object({
  displayName: fieldSchema(parseDisplayName),
  logoUrl: fieldSchema(parseLogoUrl),
  primaryColor: fieldSchema(parsePrimaryColor),
})

export type ClubBrandingFormValues = z.infer<typeof clubBrandingFormSchema>

/** Drop invalid stored values so they never become CSS or image URLs. */
export function readStoredBranding(raw: unknown): ClubBranding | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const branding: ClubBranding = {}

  if (typeof record.displayName === 'string') {
    const parsed = parseDisplayName(record.displayName)
    if (parsed.ok && parsed.value) branding.displayName = parsed.value
  }
  if (typeof record.logoUrl === 'string') {
    const parsed = parseLogoUrl(record.logoUrl)
    if (parsed.ok && parsed.value) branding.logoUrl = parsed.value
  }
  if (typeof record.primaryColor === 'string') {
    const parsed = parsePrimaryColor(record.primaryColor)
    if (parsed.ok && parsed.value) branding.primaryColor = parsed.value
  }

  return hasBranding(branding) ? branding : undefined
}

export function mergeClubBranding(
  current: ClubBranding | undefined,
  patch: ClubBrandingPatch | undefined
): ClubBranding | undefined {
  if (!patch)
    return current && hasBranding(current) ? { ...current } : undefined

  const next: ClubBranding = { ...(current ?? {}) }
  const apply = (key: keyof ClubBrandingPatch) => {
    if (!(key in patch)) return
    const value = patch[key]
    if (value) next[key] = value
    else delete next[key]
  }
  apply('displayName')
  apply('logoUrl')
  apply('primaryColor')
  return hasBranding(next) ? next : undefined
}

export function clubDisplayName(club: {
  name: string
  settings?: { branding?: ClubBranding | null } | null
}): string {
  const branded = club.settings?.branding?.displayName?.trim()
  return branded || club.name
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null
  const parsed = parsePrimaryColor(color)
  return parsed.ok ? parsed.value : null
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex)
  if (!normalized) return 0
  const n = parseInt(normalized.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function foregroundForBackground(hex: string): string {
  return relativeLuminance(hex) < 0.45 ? PLATFORM_CHROME_FOREGROUND : '#18181b'
}

/**
 * CSS variables for club-owned chrome. Falls back to Soccerville red when
 * the club has no valid primary color.
 */
export function clubChromeStyle(primaryColor?: string | null): ClubChromeStyle {
  const background = normalizeHex(primaryColor) ?? PLATFORM_CHROME_BACKGROUND
  return {
    '--club-primary': background,
    '--club-foreground': foregroundForBackground(background),
    backgroundColor: 'var(--club-primary)',
    color: 'var(--club-foreground)',
  }
}
