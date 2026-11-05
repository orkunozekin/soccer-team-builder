'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { PositionSelector } from '@/components/profile/PositionSelector'
import {
  type SkillAnswersDraft,
  SkillQuestionnaire,
  isSkillQuestionnaireComplete,
} from '@/components/skill/SkillQuestionnaire'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SkillAnswers } from '@/types/skill'

interface RSVPPositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPosition: string | null
  /** `skillAnswers` is set only when the player completed the optional skill step. */
  onConfirm: (
    position: string | null,
    skillAnswers?: SkillAnswers
  ) => void | Promise<void>
  loading?: boolean
  /** Team occupancy counts when the user is already on a team */
  occupancy?: Record<string, number>
  /** Offer the optional "Your game" questionnaire step after position. */
  showSkillStep?: boolean
}

type Step = 'position' | 'skill'

export function RSVPPositionModal({
  open,
  onOpenChange,
  defaultPosition,
  onConfirm,
  loading = false,
  occupancy,
  showSkillStep = false,
}: RSVPPositionModalProps) {
  const [position, setPosition] = useState<string | null>(defaultPosition)
  const [step, setStep] = useState<Step>('position')
  const [skillAnswers, setSkillAnswers] = useState<SkillAnswersDraft>({})
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (dialogRef.current) dialogRef.current.scrollTop = 0
  }, [step])
  useEffect(() => {
    if (open) {
      setPosition(defaultPosition)
      setStep('position')
      setSkillAnswers({})
    }
  }, [open, defaultPosition])

  const handleConfirm = async (answers?: SkillAnswers) => {
    await onConfirm(position, answers)
    onOpenChange(false)
  }

  if (!mounted || !open) return null

  const onSkillStep = step === 'skill'
  const skillComplete = isSkillQuestionnaireComplete(skillAnswers)

  const modal = (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={() => !loading && onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-position-modal-title"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain',
          'rounded-xl border border-border bg-card p-6 shadow-xl',
          'duration-200 animate-in fade-in-0 zoom-in-95'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => !loading && onOpenChange(false)}
            aria-label="Close"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="mb-4 pr-8">
            <h2
              id="rsvp-position-modal-title"
              className="font-display text-2xl font-extrabold uppercase leading-none tracking-[0.02em] text-foreground"
            >
              {onSkillStep ? 'Your game' : 'Select your position'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {onSkillStep
                ? 'Optional: helps admins balance teams. Only club admins see your answers.'
                : 'Choose the position you want to play for this match.'}
            </p>
          </div>
          {onSkillStep ? (
            <SkillQuestionnaire
              value={skillAnswers}
              onChange={setSkillAnswers}
              disabled={loading}
            />
          ) : (
            <PositionSelector
              value={position}
              onValueChange={setPosition}
              disabled={loading}
              occupancy={
                occupancy && Object.keys(occupancy).length > 0
                  ? occupancy
                  : undefined
              }
            />
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {onSkillStep ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto"
                  onClick={() => setStep('position')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleConfirm()}
                  disabled={loading}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    isSkillQuestionnaireComplete(skillAnswers) &&
                    handleConfirm(skillAnswers)
                  }
                  loading={loading}
                  disabled={!skillComplete}
                >
                  Confirm RSVP
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => !loading && onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                {showSkillStep ? (
                  <Button
                    type="button"
                    onClick={() => setStep('skill')}
                    disabled={loading}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleConfirm()}
                    loading={loading}
                  >
                    Confirm RSVP
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
