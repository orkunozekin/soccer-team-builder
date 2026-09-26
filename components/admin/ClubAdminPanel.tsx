'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  backfillClubMembershipsAPI,
  createClubAPI,
} from '@/lib/api/client'

/**
 * Super-user tools: create founding club + run membership backfill.
 */
export function ClubAdminPanel() {
  const [name, setName] = useState('Soccerville')
  const [slug, setSlug] = useState('soccerville')
  const [clubId, setClubId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<string>('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult('')
    setLoading(true)
    try {
      const res = await createClubAPI({
        name: name.trim(),
        slug: slug.trim() || undefined,
      })
      setClubId(res.club.id)
      setResult(`Created club “${res.club.name}” (${res.club.id})`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club')
    } finally {
      setLoading(false)
    }
  }

  const handleBackfill = async () => {
    if (!clubId.trim()) {
      setError('Enter a club id to backfill')
      return
    }
    setError('')
    setResult('')
    setLoading(true)
    try {
      const res = await backfillClubMembershipsAPI(clubId.trim())
      setResult(
        `Backfill complete: ${JSON.stringify(res, null, 2)}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backfill failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clubs (white-label)</CardTitle>
        <CardDescription>
          Create the founding club, then backfill existing users and match
          clubIds. Idempotent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {result && (
          <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
            {result}
          </pre>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="club-name">Club name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="club-slug">Slug</Label>
            <Input
              id="club-slug"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="soccerville"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Create club
          </Button>
        </form>

        <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="space-y-1.5">
            <Label htmlFor="backfill-club-id">Club ID for backfill</Label>
            <Input
              id="backfill-club-id"
              value={clubId}
              onChange={e => setClubId(e.target.value)}
              placeholder="paste club id"
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleBackfill}
          >
            Run membership backfill
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
