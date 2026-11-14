'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { CodeOfConductContent } from '@/components/conduct/CodeOfConductContent'
import { PositionSelector } from '@/components/profile/PositionSelector'
import {
  type SkillAnswersDraft,
  SkillQuestionnaire,
  isSkillQuestionnaireComplete,
} from '@/components/skill/SkillQuestionnaire'
import { Button } from '@/components/ui/button'
import { CODE_OF_CONDUCT_VERSION } from '@/lib/conduct/codeOfConduct'
import type { CodeOfConductStepMode } from '@/lib/conduct/useCodeOfConductStatus'
import { cn } from '@/lib/utils'
import type { SkillAnswers } from '@/types/skill'

interface RSVPPositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPosition: string | null
  /**
   * `skillAnswers` is set when the skill step was shown (always complete).
   * `acceptedCodeOfConductVersion` is set when the member ticked the code of
   * conduct box. Resolve `false` to keep the modal open (e.g. the answers
   * failed to save, or the server asked for the code of conduct).
   */
  onConfirm: (
    position: string | null,
    skillAnswers?: SkillAnswers,
    acceptedCodeOfConductVersion?: string
  ) => void | boolean | Promise<void | boolean>
  loading?: boolean
  /** Team occupancy counts when the user is already on a team */
  occupancy?: Record<string, number>
  /**
   * Skill questionnaire step after position:
   * - `'none'`: no step (already answered, or the feature is off)
   * - `'checking'`: still finding out whether the player has answered
   * - `'required'`: the player must answer before the RSVP is sent
   */
  skillStep?: SkillStepMode
  /** Shown on the skill step, e.g. when saving the answers failed. */
  skillError?: string | null
  /** Code of conduct step, last before confirming (same modes as `skillStep`). */
  conductStep?: CodeOfConductStepMode
  /** Shown above the buttons on any step, e.g. why the RSVP didn't go through. */
  error?: string | null
}

export type SkillStepMode = 'none' | 'checking' | 'required'

type Step = 'position' | 'skill' | 'conduct'

const STEP_TITLES: Record<Step, string> = {
  position: 'Select your position',
  skill: 'Your game',
  conduct: 'Code of conduct',
}

const STEP_DESCRIPTIONS: Record<Step, string> = {
  position: 'Choose the position you want to play for this match.',
  skill:
    'Answer once to RSVP. It helps admins build even teams, and only club admins see your answers.',
  conduct: 'This club asks every member to agree once before their first RSVP.',
}

export function RSVPPositionModal({
  open,
  onOpenChange,
  defaultPosition,
  onConfirm,
  loading = false,
  occupancy,
  skillStep = 'none',
  skillError = null,
  conductStep = 'none',
  error = null,
}: RSVPPositionModalProps) {
  const [position, setPosition] = useState<string | null>(defaultPosition)
  const [step, setStep] = useState<Step>('position')
  const [skillAnswers, setSkillAnswers] = useState<SkillAnswersDraft>({})
  const [conductAgreed, setConductAgreed] = useState(false)
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
      setConductAgreed(false)
    }
  }, [open, defaultPosition])

  const steps: { step: Step; mode: SkillStepMode }[] = [
    { step: 'position', mode: 'required' },
    { step: 'skill', mode: skillStep },
    { step: 'conduct', mode: conductStep },
  ]
  const flow = steps.filter(entry => entry.mode !== 'none')
  // A step can drop out of the flow (e.g. the member already agreed); fall
  // back to the first step rather than show one that no longer applies.
  const currentIndex = Math.max(
    0,
    flow.findIndex(entry => entry.step === step)
  )
  const current = flow[currentIndex].step
  const previous = currentIndex > 0 ? flow[currentIndex - 1] : undefined
  const next = flow[currentIndex + 1]

  const handleConfirm = async () => {
    const answers =
      skillStep !== 'none' && isSkillQuestionnaireComplete(skillAnswers)
        ? skillAnswers
        : undefined
    const acceptedVersion =
      conductStep !== 'none' && conductAgreed
        ? CODE_OF_CONDUCT_VERSION
        : undefined
    const result =
      acceptedVersion === undefined
        ? await onConfirm(position, answers)
        : await onConfirm(position, answers, acceptedVersion)
    if (result === false) return
    onOpenChange(false)
  }

  if (!mounted || !open) return null

  const onSkillStep = current === 'skill'
  const onConductStep = current === 'conduct'
  const stepComplete =
    current === 'skill'
      ? isSkillQuestionnaireComplete(skillAnswers)
      : current === 'conduct'
        ? conductAgreed
        : true

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
              {STEP_TITLES[current]}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {STEP_DESCRIPTIONS[current]}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-danger-wash/20 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}
          {onSkillStep && skillError && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-danger-wash/20 p-3 text-sm text-danger"
            >
              {skillError}
            </div>
          )}
          {onSkillStep ? (
            <SkillQuestionnaire
              value={skillAnswers}
              onChange={setSkillAnswers}
              disabled={loading}
            />
          ) : onConductStep ? (
            <div className="space-y-4">
              <div className="max-h-[45dvh] overflow-y-auto rounded-md border border-border p-3">
                <CodeOfConductContent />
              </div>
              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={conductAgreed}
                  disabled={loading}
                  onChange={e => setConductAgreed(e.target.checked)}
                />
                <span>
                  I agree to follow the code of conduct.{' '}
                  <Link
                    href="/code-of-conduct"
                    target="_blank"
                    className="text-muted-foreground underline underline-offset-2"
                  >
                    Open in a new tab
                  </Link>
                </span>
              </label>
            </div>
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
            {previous ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={() => setStep(previous.step)}
                disabled={loading}
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => !loading && onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            {next ? (
              <Button
                type="button"
                onClick={() => setStep(next.step)}
                aria-busy={next.mode === 'checking' || undefined}
                disabled={loading || !stepComplete || next.mode === 'checking'}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => stepComplete && handleConfirm()}
                loading={loading}
                disabled={!stepComplete}
              >
                Confirm RSVP
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modal, document.body)
}
