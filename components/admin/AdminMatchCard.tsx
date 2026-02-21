'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteMatchAPI } from '@/lib/api/client'
import { Match } from '@/types/match'

interface AdminMatchCardProps {
  match: Match
  rsvpCount?: number
  onDeleted?: () => void
}

export function AdminMatchCard({
  match,
  rsvpCount,
  onDeleted,
}: AdminMatchCardProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const matchDate = new Date(match.date)
  const formattedDate = format(matchDate, 'EEEE, MMM d')
  const formattedTime = format(matchDate, 'h:mm a')

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
      <Link href={`/admin/matches/${match.id}`}>
        <Card className="transition-all hover:shadow-md cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{formattedDate}</CardTitle>
              <CardDescription className="text-base">
                {formattedTime}
              </CardDescription>
              {match.location && (
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  @ {match.location}
                </p>
              )}
            </div>
            <Badge
              variant={match.rsvpOpen ? 'default' : 'outline'}
              className="shrink-0 py-1 text-xs"
            >
              {match.rsvpOpen ? 'RSVP Open' : 'RSVP Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {rsvpCount !== undefined && (
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {rsvpCount} {rsvpCount === 1 ? 'player' : 'players'} confirmed
            </p>
          )}
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              loading={deleting}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(true)
              }}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
      </Link>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the match, its teams, and RSVPs. This cannot be undone.
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
              {deleting ? <ButtonSpinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
