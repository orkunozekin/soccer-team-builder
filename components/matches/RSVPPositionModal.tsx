'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { PositionSelector } from '@/components/profile/PositionSelector'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RSVPPositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPosition: string | null
  onConfirm: (position: string | null) => void | Promise<void>
  loading?: boolean
}

export function RSVPPositionModal({
  open,
  onOpenChange,
  defaultPosition,
  onConfirm,
  loading = false,
}: RSVPPositionModalProps) {
  const [position, setPosition] = useState<string | null>(defaultPosition)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (open) setPosition(defaultPosition)
  }, [open, defaultPosition])

  const handleConfirm = async () => {
    await onConfirm(position)
    onOpenChange(false)
  }

  if (!mounted || !open) return null

  const modal = (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={() => !loading && onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-position-modal-title"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950',
          'duration-200 animate-in fade-in-0 zoom-in-95'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => !loading && onOpenChange(false)}
            aria-label="Close"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="mb-4 pr-8">
            <h2
              id="rsvp-position-modal-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Select your position
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Choose the position you want to play for this match.
            </p>
          </div>
          <PositionSelector
            value={position}
            onValueChange={setPosition}
            disabled={loading}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => !loading && onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} loading={loading}>
              Confirm RSVP
            </Button>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
