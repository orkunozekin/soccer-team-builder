import { describe, expect, it } from 'vitest'
import {
  PLATFORM_CHROME_BACKGROUND,
  clubChromeStyle,
  clubDisplayName,
  foregroundForBackground,
  mergeClubBranding,
  parseClubBrandingInput,
  readStoredBranding,
} from './clubBranding'

describe('parseClubBrandingInput', () => {
  it('treats a missing object as no update', () => {
    expect(parseClubBrandingInput(undefined)).toEqual({
      ok: true,
      patch: undefined,
    })
  })

  it('rejects values that are not a display name, https logo, or #rrggbb color', () => {
    expect(parseClubBrandingInput({ primaryColor: 'red' })).toEqual({
      ok: false,
      error: 'Primary color must be a #rrggbb hex color',
    })
    expect(parseClubBrandingInput({ primaryColor: '#abc' })).toMatchObject({
      ok: false,
    })
    expect(parseClubBrandingInput({ primaryColor: '#11223344' })).toMatchObject(
      {
        ok: false,
      }
    )
    expect(
      parseClubBrandingInput({ logoUrl: 'http://cdn.example/logo.png' })
    ).toEqual({
      ok: false,
      error: 'Logo URL must be an https URL',
    })
    expect(
      parseClubBrandingInput({ logoUrl: 'javascript:alert(1)' })
    ).toMatchObject({
      ok: false,
    })
    expect(parseClubBrandingInput('nope')).toEqual({
      ok: false,
      error: 'Invalid club branding',
    })
    expect(
      parseClubBrandingInput({ displayName: 'a'.repeat(81) })
    ).toMatchObject({ ok: false })
    expect(parseClubBrandingInput({ displayName: 'Line\nbreak' })).toEqual({
      ok: false,
      error: 'Display name is invalid',
    })
  })

  it('normalizes valid fields and uses empty strings as clears', () => {
    expect(
      parseClubBrandingInput({
        displayName: '  Wolves  ',
        logoUrl: 'https://cdn.example/logo.png',
        primaryColor: '#AABBCC',
      })
    ).toEqual({
      ok: true,
      patch: {
        displayName: 'Wolves',
        logoUrl: 'https://cdn.example/logo.png',
        primaryColor: '#aabbcc',
      },
    })
    expect(
      parseClubBrandingInput({
        displayName: '   ',
        logoUrl: '',
        primaryColor: '',
      })
    ).toEqual({
      ok: true,
      patch: {
        displayName: null,
        logoUrl: null,
        primaryColor: null,
      },
    })
  })
})

describe('mergeClubBranding', () => {
  it('keeps untouched fields and drops cleared ones', () => {
    expect(
      mergeClubBranding(
        {
          displayName: 'Wolves',
          logoUrl: 'https://cdn.example/logo.png',
          primaryColor: '#112233',
        },
        { primaryColor: null, displayName: 'Pack' }
      )
    ).toEqual({
      displayName: 'Pack',
      logoUrl: 'https://cdn.example/logo.png',
    })
  })

  it('returns undefined when every field is cleared', () => {
    expect(
      mergeClubBranding({ primaryColor: '#112233' }, { primaryColor: null })
    ).toBeUndefined()
  })
})

describe('readStoredBranding', () => {
  it('drops invalid stored color and logo values', () => {
    expect(
      readStoredBranding({
        displayName: 'Wolves',
        logoUrl: 'http://insecure.example/logo.png',
        primaryColor: 'red',
      })
    ).toEqual({ displayName: 'Wolves' })
  })
})

describe('clubDisplayName', () => {
  it('falls back to the club name', () => {
    expect(clubDisplayName({ name: 'Alpha FC' })).toBe('Alpha FC')
    expect(
      clubDisplayName({
        name: 'Alpha FC',
        settings: { branding: { displayName: 'Wolves' } },
      })
    ).toBe('Wolves')
  })
})

describe('clubChromeStyle', () => {
  it('uses Soccerville red and white text when no color is set', () => {
    expect(clubChromeStyle(undefined)).toMatchObject({
      '--club-primary': PLATFORM_CHROME_BACKGROUND,
      '--club-foreground': '#ffffff',
    })
    expect(foregroundForBackground('#CC0000')).toBe('#ffffff')
  })

  it('uses the club color and a dark foreground on light backgrounds', () => {
    expect(clubChromeStyle('#F5E642')).toMatchObject({
      '--club-primary': '#f5e642',
      '--club-foreground': '#18181b',
    })
    expect(clubChromeStyle('not-a-color')['--club-primary']).toBe(
      PLATFORM_CHROME_BACKGROUND
    )
  })
})
