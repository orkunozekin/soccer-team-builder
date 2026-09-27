'use client'

import { useState } from 'react'
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
      setError(
        err instanceof Error ? err.message : 'Failed to update settings'
      )
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

      {saved && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}
    </div>
  )
}
