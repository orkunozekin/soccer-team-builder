'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { updateClubAPI } from '@/lib/api/client'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'

export function ClubSettingsPanel({
  clubId,
  clubName,
  initialAllowPlayerInvites,
}: {
  clubId: string
  clubName: string
  initialAllowPlayerInvites: boolean
}) {
  const { refresh } = useClubMemberships()
  const [allowPlayerInvites, setAllowPlayerInvites] = useState(
    initialAllowPlayerInvites
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAllowPlayerInvites(initialAllowPlayerInvites)
    setBusy(false)
    setError('')
    setSaved(false)
  }, [clubId, initialAllowPlayerInvites])

  const handleToggle = async (next: boolean) => {
    setBusy(true)
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
          checked={allowPlayerInvites}
          disabled={busy}
          onChange={e => void handleToggle(e.target.checked)}
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

      {saved && <p className="text-sm text-success-bright">Saved.</p>}
    </div>
  )
}
