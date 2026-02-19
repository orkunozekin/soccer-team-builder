'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Match } from '@/types/match'
import { deleteMatchAPI } from '@/lib/api/client'

interface AdminMatchCardProps {
  match: Match
  onDeleted?: () => void
}

export function AdminMatchCard({
  match,
  onDeleted,
}: AdminMatchCardProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteMatchAPI(match.id)
      setOpen(false)
      onDeleted?.()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
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
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(true)
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the match, its teams, bench, and RSVPs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
