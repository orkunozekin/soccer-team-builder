'use client'

import { useId } from 'react'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'
import { cn } from '@/lib/utils'
import {
  SKILL_QUESTION_KEYS,
  type SkillAnswerValue,
  type SkillAnswers,
} from '@/types/skill'

/** Answers while the form is being filled in (any question may be unanswered). */
export type SkillAnswersDraft = Partial<SkillAnswers>

function isAnswerValue(value: unknown): value is SkillAnswerValue {
  return value === 1 || value === 2 || value === 3
}

/** True when every questionnaire question has a valid answer. */
export function isSkillQuestionnaireComplete(
  answers: SkillAnswersDraft
): answers is SkillAnswers {
  return SKILL_QUESTION_KEYS.every(key => isAnswerValue(answers[key]))
}

/**
 * Controlled skills questionnaire: one radio group per question. Radio names
 * are unique per instance, so the RSVP modal and the profile form can both be
 * mounted without sharing selection.
 */
export function SkillQuestionnaire({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: SkillAnswersDraft
  onChange: (next: SkillAnswersDraft) => void
  disabled?: boolean
  className?: string
}) {
  const instanceId = useId()

  return (
    <div className={cn('space-y-5', className)}>
      {SKILL_QUESTIONNAIRE.map(question => {
        const name = `${instanceId}-${question.key}`
        return (
          <fieldset key={question.key} className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">
              {question.prompt}
            </legend>
            {question.options.map(option => {
              const checked = value[question.key] === option.value
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors',
                    'hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                    checked &&
                      'border-primary bg-primary/10 hover:bg-primary/10',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={option.value}
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onChange({ ...value, [question.key]: option.value })
                    }
                    className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none"
                  />
                  <span className="min-w-0 break-words">{option.label}</span>
                </label>
              )
            })}
          </fieldset>
        )
      })}
    </div>
  )
}
