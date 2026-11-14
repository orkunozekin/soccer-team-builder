'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { updateClubAPI } from '@/lib/api/client'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'

type ToggleSetting = 'allowPlayerInvites' | 'requireCodeOfConduct'

export function ClubSettingsPanel({
  clubId,
  clubName,
  initialAllowPlayerInvites,
  initialRequireCodeOfConduct = false,
}: {
  clubId: string
  clubName: string
  initialAllowPlayerInvites: boolean
  initialRequireCodeOfConduct?: boolean
}) {
  const { refresh } = useClubMemberships()
  const [values, setValues] = useState<Record<ToggleSetting, boolean>>({
    allowPlayerInvites: initialAllowPlayerInvites,
    requireCodeOfConduct: initialRequireCodeOfConduct,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValues({
      allowPlayerInvites: initialAllowPlayerInvites,
      requireCodeOfConduct: initialRequireCodeOfConduct,
    })
    setBusy(false)
    setError('')
    setSaved(false)
  }, [clubId, initialAllowPlayerInvites, initialRequireCodeOfConduct])

  const handleToggle = async (setting: ToggleSetting, next: boolean) => {
    setBusy(true)
    setError('')
    setSaved(false)
    const previous = values[setting]
    setValues(current => ({ ...current, [setting]: next }))
    try {
      await updateClubAPI(clubId, { settings: { [setting]: next } })
    } catch (err) {
      setValues(current => ({ ...current, [setting]: previous }))
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      setBusy(false)
      return
    }

    try {
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      // Setting is already saved; keep the new checkbox value.
      setError(
        err instanceof Error
          ? `Saved, but failed to refresh clubs: ${err.message}`
          : 'Saved, but failed to refresh clubs'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        eyebrow="Club admin"
        title="Settings"
        description={`Club options for ${clubName}.`}
      />

      {error && (
        <div className="rounded-md bg-danger-wash/20 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-mist">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.allowPlayerInvites}
          disabled={busy}
          onChange={e =>
            void handleToggle('allowPlayerInvites', e.target.checked)
          }
        />
        <span>
          <span className="font-medium text-foreground">
            Players can invite
          </span>
          <span className="mt-0.5 block text-muted-foreground">
            When on, players in this club can create invite codes. Club admins
            can always invite.
          </span>
        </span>
      </label>

      <div className="flex items-start gap-3 text-sm text-mist">
        <input
          id="require-code-of-conduct"
          type="checkbox"
          className="mt-1"
          checked={values.requireCodeOfConduct}
          disabled={busy}
          onChange={e =>
            void handleToggle('requireCodeOfConduct', e.target.checked)
          }
        />
        <span>
          <label
            htmlFor="require-code-of-conduct"
            className="font-medium text-foreground"
          >
            Require the code of conduct
          </label>
          <span className="mt-0.5 block text-muted-foreground">
            When on, members must agree to the{' '}
            <Link
              href="/code-of-conduct"
              target="_blank"
              className="underline underline-offset-2"
            >
              code of conduct
            </Link>{' '}
            before their next RSVP. Each member agrees once, and an agreement
            counts for every club.
          </span>
        </span>
      </div>

      {saved && <p className="text-sm text-success-bright">Saved.</p>}
    </div>
  )
}
