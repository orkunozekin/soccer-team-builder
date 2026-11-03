'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { deleteMatchAPI } from '@/lib/api/client'
import type { Match } from '@/types/match'

/** Icon button that soft-deletes a match after a confirmation dialog. */
export function DeleteMatchButton({
  match,
  onDeleted,
}: {
  match: Pick<Match, 'id' | 'date'>
  onDeleted?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteMatchAPI(match.id)
      setOpen(false)
      onDeleted?.()
    } catch {
      alert('Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-full"
        aria-label={`Delete match on ${format(new Date(match.date), 'EEEE, MMM d')}`}
        loading={deleting}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the match from listings and close RSVPs. Match
              history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
              disabled={deleting}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {deleting ? <ButtonSpinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
