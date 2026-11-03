'use client'

import { useEffect } from 'react'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import { cn } from '@/lib/utils'

interface RSVPSuccessCelebrationProps {
  show: boolean
  onDone: () => void
}

const CONFETTI = [
  { left: '12%', delay: '0ms', color: 'bg-red-50' },
  { left: '22%', delay: '120ms', color: 'bg-confetti' },
  { left: '35%', delay: '60ms', color: 'bg-red-70' },
  { left: '48%', delay: '180ms', color: 'bg-red-50' },
  { left: '58%', delay: '40ms', color: 'bg-confetti' },
  { left: '68%', delay: '140ms', color: 'bg-red-40' },
  { left: '78%', delay: '90ms', color: 'bg-red-50' },
  { left: '88%', delay: '200ms', color: 'bg-confetti' },
]

export function RSVPSuccessCelebration({
  show,
  onDone,
}: RSVPSuccessCelebrationProps) {
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDone, 2800)
    return () => clearTimeout(timer)
  }, [show, onDone])

  if (!show) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="RSVP confirmed"
    >
      <div className="absolute inset-0 overflow-hidden">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className={cn(
              'absolute top-0 h-3 w-2 animate-confetti-fall rounded-sm opacity-90',
              piece.color
            )}
            style={{ left: piece.left, animationDelay: piece.delay }}
          />
        ))}
      </div>

      <div className="relative flex animate-scale-in flex-col items-center gap-3 rounded-2xl border-2 border-red-50 bg-popover px-10 py-8 shadow-2xl">
        <div className="absolute -inset-1 animate-pulse-ring rounded-2xl border-2 border-red-50/40" />
        <SoccerBallIcon className="h-16 w-16 animate-ball-bounce text-red-50" />
        <p className="font-display text-4xl font-black uppercase text-chalk">
          You&apos;re in!
        </p>
        <p className="text-sm font-medium text-muted-foreground">
          See you on the pitch
        </p>
      </div>
    </div>
  )
}
