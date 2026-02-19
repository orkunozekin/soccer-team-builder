'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Match } from '@/types/match'
import { deleteMatchAPI } from '@/lib/api/client'

interface AdminMatchCardProps {
  match: Match
  isSuperAdmin: boolean
  onDeleted?: () => void
}

export function AdminMatchCard({
  match,
  isSuperAdmin,
  onDeleted,
}: AdminMatchCardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this match? This will remove the match, its teams, bench, and RSVPs. This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteMatchAPI(match.id)
      onDeleted?.()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="transition-all hover:shadow-md h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">
          {format(match.date, 'MMM d, yyyy')}
        </CardTitle>
        <CardDescription>
          {format(match.date, 'h:mm a')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        <Link
          href={`/admin/matches/${match.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage match →
        </Link>
        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <Link href={`/admin/matches/${match.id}/edit`}>
              <Button variant="outline" size="sm" className="h-8">
                Edit
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
