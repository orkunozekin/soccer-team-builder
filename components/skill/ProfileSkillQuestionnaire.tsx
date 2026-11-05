'use client'

import { useEffect, useState } from 'react'
import {
  type SkillAnswersDraft,
  SkillQuestionnaire,
  isSkillQuestionnaireComplete,
} from '@/components/skill/SkillQuestionnaire'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SKILL_ASSESSMENT_LOAD_ERROR,
  SKILL_ASSESSMENT_SAVE_ERROR,
  clearSkillAssessmentSaveStatus,
  loadSkillAssessment,
  saveSkillAssessment,
  useSkillAssessment,
} from '@/store/skillAssessmentStore'

/**
 * Profile editor for the player's skills questionnaire. Render it keyed by
 * `uid` so local answers never carry over to another account.
 */
export function ProfileSkillQuestionnaire({ uid }: { uid: string }) {
  const { loadStatus, assessment, saveStatus } = useSkillAssessment(uid)
  const [answers, setAnswers] = useState<SkillAnswersDraft>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    // A result from an earlier save (e.g. the RSVP step) isn't this form's.
    clearSkillAssessmentSaveStatus(uid)
    void loadSkillAssessment(uid)
  }, [uid])

  // Show the stored answers (including ones just saved from the RSVP step)
  // until the player starts editing.
  useEffect(() => {
    if (!dirty) setAnswers(assessment ? { ...assessment.answers } : {})
  }, [assessment, dirty])

  if (loadStatus === 'error') {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm text-danger">{SKILL_ASSESSMENT_LOAD_ERROR}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadSkillAssessment(uid, { force: true })}
        >
          Retry
        </Button>
      </div>
    )
  }

  if (loadStatus !== 'loaded') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  const saving = saveStatus === 'saving'
  const complete = isSkillQuestionnaireComplete(answers)

  const handleChange = (next: SkillAnswersDraft) => {
    setAnswers(next)
    setDirty(true)
    clearSkillAssessmentSaveStatus(uid)
  }

  const handleSave = async () => {
    if (!isSkillQuestionnaireComplete(answers)) return
    const saved = await saveSkillAssessment(uid, answers)
    if (saved) setDirty(false)
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Only club admins see your answers.
      </p>
      <SkillQuestionnaire
        value={answers}
        onChange={handleChange}
        disabled={saving}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          onClick={handleSave}
          loading={saving}
          disabled={!complete}
        >
          Save answers
        </Button>
        <p className="min-w-0 text-sm" role="status" aria-live="polite">
          {saveStatus === 'saved' && !dirty && (
            <span className="text-success">Answers saved.</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-danger">{SKILL_ASSESSMENT_SAVE_ERROR}</span>
          )}
        </p>
      </div>
    </div>
  )
}
