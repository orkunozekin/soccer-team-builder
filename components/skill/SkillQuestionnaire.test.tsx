import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  type SkillAnswersDraft,
  SkillQuestionnaire,
  isSkillQuestionnaireComplete,
} from './SkillQuestionnaire'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'

function Harness({ onValue }: { onValue?: (v: SkillAnswersDraft) => void }) {
  const [value, setValue] = useState<SkillAnswersDraft>({})
  return (
    <>
      <SkillQuestionnaire
        value={value}
        onChange={next => {
          setValue(next)
          onValue?.(next)
        }}
      />
      <p>{isSkillQuestionnaireComplete(value) ? 'complete' : 'incomplete'}</p>
    </>
  )
}

describe('isSkillQuestionnaireComplete', () => {
  it('requires all four answers in range', () => {
    expect(isSkillQuestionnaireComplete({})).toBe(false)
    expect(
      isSkillQuestionnaireComplete({ firstTouch: 1, passing: 2, fitness: 3 })
    ).toBe(false)
    expect(
      isSkillQuestionnaireComplete({
        firstTouch: 1,
        passing: 2,
        fitness: 3,
        gameSense: 4 as never,
      })
    ).toBe(false)
    expect(
      isSkillQuestionnaireComplete({
        firstTouch: 1,
        passing: 2,
        fitness: 3,
        gameSense: 2,
      })
    ).toBe(true)
  })
})

describe('SkillQuestionnaire', () => {
  it('renders each question as a labelled radio group', () => {
    render(<Harness />)
    for (const question of SKILL_QUESTIONNAIRE) {
      const group = screen.getByRole('group', { name: question.prompt })
      expect(group).toBeInTheDocument()
      for (const option of question.options) {
        expect(
          screen.getByRole('radio', { name: option.label })
        ).not.toBeChecked()
      }
    }
  })

  it('selects answers and reports completeness', async () => {
    const user = userEvent.setup()
    let last: SkillAnswersDraft = {}
    render(<Harness onValue={v => (last = v)} />)

    expect(screen.getByText('incomplete')).toBeInTheDocument()
    for (const question of SKILL_QUESTIONNAIRE) {
      await user.click(
        screen.getByRole('radio', { name: question.options[2].label })
      )
    }
    expect(screen.getByText('complete')).toBeInTheDocument()
    expect(last).toEqual({
      firstTouch: 3,
      passing: 3,
      fitness: 3,
      gameSense: 3,
    })

    const firstTouchLow = screen.getByRole('radio', {
      name: SKILL_QUESTIONNAIRE[0].options[0].label,
    })
    await user.click(firstTouchLow)
    expect(firstTouchLow).toBeChecked()
    expect(last.firstTouch).toBe(1)
  })

  it('keeps two instances independent', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Harness />
        <Harness />
      </>
    )
    const label = SKILL_QUESTIONNAIRE[0].options[1].label
    const [first, second] = screen.getAllByRole('radio', { name: label })
    expect(first.getAttribute('name')).not.toBe(second.getAttribute('name'))
    await user.click(first)
    expect(first).toBeChecked()
    expect(second).not.toBeChecked()
  })

  it('disables every option when disabled', () => {
    render(<SkillQuestionnaire value={{}} onChange={() => {}} disabled />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})
