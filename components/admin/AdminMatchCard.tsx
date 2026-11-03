'use client'

import { useState } from 'react'
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
import { MatchCard } from '@/components/matches/MatchCard'
import { Button, buttonVariants } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { deleteMatchAPI } from '@/lib/api/client'
import { Match } from '@/types/match'

interface AdminMatchCardProps {
  match: Match
  rsvpCount?: number
  onDeleted?: () => void
  /** Detail URL. Defaults to the legacy admin match route. */
  href?: string
  /** Index for staggered entrance animation */
  index?: number
}

export function AdminMatchCard({
  match,
  rsvpCount,
  onDeleted,
  href,
  index,
}: AdminMatchCardProps) {
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
      <MatchCard
        match={match}
        rsvpCount={rsvpCount}
        href={href ?? `/admin/matches/${match.id}`}
        index={index}
        isAdmin
        actions={
          <Button
            variant="destructive"
            size="sm"
            className="h-9 rounded-full px-4"
            loading={deleting}
            onClick={() => setOpen(true)}
          >
            Delete
          </Button>
        }
      />

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
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
                handleConfirmDelete()
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
