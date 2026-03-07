'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { cancelRSVPAPI, confirmRSVPAPI, searchUsersAPI } from '@/lib/api/client'
import { Match } from '@/types/match'
import { RSVP } from '@/types/rsvp'

type SearchUser = {
  uid: string
  email: string
  displayName: string
  role: 'user' | 'admin'
}

interface ImpersonateRSVPProps {
  match: Match
  matchRSVPs: RSVP[]
  onDone?: () => void | Promise<void>
}

export function ImpersonateRSVP({ match, matchRSVPs, onDone }: ImpersonateRSVPProps) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchUser | null>(null)
  const [position, setPosition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      searchUsersAPI(q, 15)
        .then((res) => {
          if (!cancelled) setSearchResults(res.users)
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const selectedRsvp = selected ? matchRSVPs.find((r) => r.userId === selected.uid) ?? null : null
  const hasRsvp = !!selectedRsvp

  const handleConfirmRSVP = async () => {
    if (!selected || !match.rsvpOpen) return
    setLoading(true)
    setError('')
    try {
      await confirmRSVPAPI(match.id, position ?? undefined, selected.uid)
      setSelected(null)
      setPosition(null)
      await onDone?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to RSVP')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelRSVP = async () => {
    if (!selectedRsvp) return
    setLoading(true)
    setError('')
    try {
      await cancelRSVPAPI(selectedRsvp.id)
      setSelected(null)
      setPosition(null)
      await onDone?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel RSVP')
    } finally {
      setLoading(false)
    }
  }

  if (!match.rsvpOpen) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RSVP as player</CardTitle>
        <CardDescription>
          Search for a user and RSVP or cancel on their behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="impersonate-search">Search by name or email</Label>
          <Input
            id="impersonate-search"
            type="text"
            placeholder="Type to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {searching && (
          <p className="text-sm text-zinc-500">Searching...</p>
        )}

        {!searching && query.trim() && searchResults.length > 0 && !selected && (
          <ul className="border rounded-md divide-y max-h-40 overflow-y-auto">
            {searchResults.map((u) => (
              <li key={u.uid}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setSelected(u)
                    setQuery('')
                    setSearchResults([])
                  }}
                >
                  {u.displayName || u.email || u.uid}
                  {u.email && u.displayName && (
                    <span className="text-zinc-500 ml-1">({u.email})</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="rounded-md border p-3 space-y-3 bg-zinc-50 dark:bg-zinc-900/50">
            <p className="text-sm font-medium">
              {hasRsvp ? 'Cancel RSVP for' : 'RSVP as'}{' '}
              <span className="text-zinc-900 dark:text-zinc-100">
                {selected.displayName || selected.email || selected.uid}
              </span>
            </p>
            {hasRsvp ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelRSVP}
                  loading={loading}
                >
                  Cancel RSVP
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[12rem]">
                    <PositionSelector
                      value={position}
                      onValueChange={setPosition}
                      disabled={loading}
                      hideLabel
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleConfirmRSVP}
                    loading={loading}
                  >
                    RSVP as this player
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelected(null); setPosition(null) }}
                    disabled={loading}
                  >
                    Clear
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Position is optional; profile position is used if not set.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
