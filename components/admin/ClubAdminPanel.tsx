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
import { createClubAPI } from '@/lib/api/client'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'

/** Super-user tool to create a new club. Slug is derived from the name. */
export function ClubAdminPanel() {
  const clubCreationEnabled = useFeatureFlag('club-creation')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  if (!clubCreationEnabled) {
    return null
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Club name is required')
      return
    }
    setLoading(true)
    try {
      const res = await createClubAPI({ name: trimmed })
      setName('')
      setResult(
        `Created club “${res.club.name}” (${res.club.id}, slug: ${res.club.slug})`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clubs</CardTitle>
        <CardDescription>
          Create a new club. The URL slug is generated from the name; both must
          be unique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            {result}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="club-name">Club name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Club name"
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create club'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
