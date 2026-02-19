'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteMatchAPI } from '@/lib/api/client'
import { Match } from '@/types/match'

interface AdminMatchCardProps {
  match: Match
  onDeleted?: () => void
}

export function AdminMatchCard({
  match,
  onDeleted,
}: AdminMatchCardProps) {
  const router = useRouter()
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
      <Card
        className="transition-all hover:shadow-md h-full flex flex-col cursor-pointer"
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/admin/matches/${match.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(`/admin/matches/${match.id}`)
          }
        }}
      >
        <CardHeader>
          <CardTitle className="text-lg">
            {format(match.date, 'MMM d, yyyy')}
          </CardTitle>
          <CardDescription>
            {format(match.date, 'h:mm a')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
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
