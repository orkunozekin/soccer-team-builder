'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateClubAPI } from '@/lib/api/client'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import {
  type ClubBrandingFormValues,
  PLATFORM_CHROME_BACKGROUND,
  clubBrandingFormSchema,
  parseClubBrandingInput,
} from '@/lib/utils/clubBranding'
import type { ClubBranding } from '@/types/club'

export function ClubSettingsPanel({
  clubId,
  clubName,
  initialAllowPlayerInvites,
  initialBranding,
}: {
  clubId: string
  clubName: string
  initialAllowPlayerInvites: boolean
  initialBranding?: ClubBranding
}) {
  const { refresh } = useClubMemberships()
  const [allowPlayerInvites, setAllowPlayerInvites] = useState(
    initialAllowPlayerInvites
  )
  const [inviteBusy, setInviteBusy] = useState(false)
  const [brandingBusy, setBrandingBusy] = useState(false)
  const busy = inviteBusy || brandingBusy
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const initialDisplayName = initialBranding?.displayName ?? ''
  const initialLogoUrl = initialBranding?.logoUrl ?? ''
  const initialPrimaryColor = initialBranding?.primaryColor ?? ''

  const form = useForm<ClubBrandingFormValues>({
    resolver: zodResolver(clubBrandingFormSchema),
    defaultValues: {
      displayName: initialDisplayName,
      logoUrl: initialLogoUrl,
      primaryColor: initialPrimaryColor,
    },
  })

  useEffect(() => {
    setAllowPlayerInvites(initialAllowPlayerInvites)
    form.reset({
      displayName: initialDisplayName,
      logoUrl: initialLogoUrl,
      primaryColor: initialPrimaryColor,
    })
    setInviteBusy(false)
    setBrandingBusy(false)
    setError('')
    setSaved(false)
  }, [
    clubId,
    form,
    initialAllowPlayerInvites,
    initialDisplayName,
    initialLogoUrl,
    initialPrimaryColor,
  ])

  const markSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleToggle = async (next: boolean) => {
    setInviteBusy(true)
    setError('')
    setSaved(false)
    const previous = allowPlayerInvites
    setAllowPlayerInvites(next)
    try {
      await updateClubAPI(clubId, {
        settings: { allowPlayerInvites: next },
      })
    } catch (err) {
      setAllowPlayerInvites(previous)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      setInviteBusy(false)
      return
    }

    try {
      await refresh()
      markSaved()
    } catch (err) {
      // Setting is already saved; keep the new checkbox value.
      setError(
        err instanceof Error
          ? `Saved, but failed to refresh clubs: ${err.message}`
          : 'Saved, but failed to refresh clubs'
      )
    } finally {
      setInviteBusy(false)
    }
  }

  const handleBranding = form.handleSubmit(async values => {
    const parsed = parseClubBrandingInput(values)
    if (!parsed.ok || !parsed.patch) return

    setBrandingBusy(true)
    setError('')
    setSaved(false)
    try {
      await updateClubAPI(clubId, {
        settings: { branding: parsed.patch },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update branding')
      setBrandingBusy(false)
      return
    }

    try {
      await refresh()
      markSaved()
    } catch (err) {
      setError(
        err instanceof Error
          ? `Saved, but failed to refresh clubs: ${err.message}`
          : 'Saved, but failed to refresh clubs'
      )
    } finally {
      setBrandingBusy(false)
    }
  })

  const colorValue = form.watch('primaryColor')
  const parsedColor = parseClubBrandingInput({ primaryColor: colorValue })
  const pickerColor =
    parsedColor.ok && parsedColor.patch?.primaryColor
      ? parsedColor.patch.primaryColor
      : PLATFORM_CHROME_BACKGROUND

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Settings
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Club options for {clubName}.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={allowPlayerInvites}
          disabled={busy}
          onChange={e => void handleToggle(e.target.checked)}
        />
        <span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Players can invite
          </span>
          <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
            When on, players in this club can create invite codes. Club admins
            can always invite.
          </span>
        </span>
      </label>

      <form onSubmit={handleBranding} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Club menu branding
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Logo, name, and color appear on the club menu. Soccerville pages
            stay Soccerville red.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-display-name">Display name</Label>
          <Input
            id="club-display-name"
            {...form.register('displayName')}
            placeholder={clubName}
            disabled={busy}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Leave blank to use {clubName}.
          </p>
          {form.formState.errors.displayName ? (
            <p className="text-sm text-red-700 dark:text-red-400">
              {form.formState.errors.displayName.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-logo-url">Logo URL</Label>
          <Input
            id="club-logo-url"
            {...form.register('logoUrl')}
            placeholder="https://"
            inputMode="url"
            disabled={busy}
          />
          {form.formState.errors.logoUrl ? (
            <p className="text-sm text-red-700 dark:text-red-400">
              {form.formState.errors.logoUrl.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="club-primary-color">Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Primary color picker"
              className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-zinc-200 bg-transparent p-1 dark:border-zinc-800"
              value={pickerColor}
              disabled={busy}
              onChange={event => {
                form.setValue('primaryColor', event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
            />
            <Input
              id="club-primary-color"
              {...form.register('primaryColor')}
              placeholder="#CC0000"
              spellCheck={false}
              disabled={busy}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Use #rrggbb. Leave blank for Soccerville red.
          </p>
          {form.formState.errors.primaryColor ? (
            <p className="text-sm text-red-700 dark:text-red-400">
              {form.formState.errors.primaryColor.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" loading={brandingBusy} disabled={busy}>
          Save branding
        </Button>
      </form>

      {saved && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      )}
    </div>
  )
}
