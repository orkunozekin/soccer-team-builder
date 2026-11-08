import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileSkillQuestionnaire } from './ProfileSkillQuestionnaire'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'
import { useAuthStore } from '@/store/authStore'
import { resetSkillAssessmentStore } from '@/store/skillAssessmentStore'

const getMock = vi.fn()
const saveMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  getMySkillAssessmentAPI: (...args: unknown[]) => getMock(...args),
  saveMySkillAssessmentAPI: (...args: unknown[]) => saveMock(...args),
}))

const SAVED = {
  answers: { firstTouch: 2, passing: 2, fitness: 2, gameSense: 2 },
  updatedAt: '2026-11-01T00:00:00.000Z',
}

// The questionnaire is switched off in the app for now; this keeps the
// component working for when it comes back.
describe('ProfileSkillQuestionnaire', () => {
  beforeEach(() => {
    getMock.mockReset()
    saveMock.mockReset()
    resetSkillAssessmentStore()
    useAuthStore.setState({ user: { uid: 'user1' } as never })
  })

  it('loads saved answers and saves edits', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue({ assessment: SAVED })
    saveMock.mockResolvedValue({
      success: true,
      assessment: { ...SAVED, answers: { ...SAVED.answers, firstTouch: 3 } },
    })

    render(<ProfileSkillQuestionnaire uid="user1" />)

    expect(
      await screen.findByText('Only club admins see your answers.')
    ).toBeInTheDocument()
    const saved = screen.getByRole('radio', {
      name: SKILL_QUESTIONNAIRE[0].options[1].label,
    })
    expect(saved).toBeChecked()

    await user.click(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[2].label,
      })
    )
    await user.click(screen.getByRole('button', { name: /save answers/i }))

    expect(saveMock).toHaveBeenCalledWith({
      firstTouch: 3,
      passing: 2,
      fitness: 2,
      gameSense: 2,
    })
    expect(await screen.findByText('Answers saved.')).toBeInTheDocument()
  })

  it('enables Save only when every question is answered', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue({ assessment: null })

    render(<ProfileSkillQuestionnaire uid="user1" />)

    const save = await screen.findByRole('button', { name: /save answers/i })
    expect(save).toBeDisabled()
    for (const question of SKILL_QUESTIONNAIRE.slice(0, 3)) {
      await user.click(
        screen.getByRole('radio', { name: question.options[0].label })
      )
    }
    expect(save).toBeDisabled()
    await user.click(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[3].options[0].label,
      })
    )
    expect(save).toBeEnabled()
  })

  it('shows a save error', async () => {
    const user = userEvent.setup()
    getMock.mockResolvedValue({ assessment: SAVED })
    saveMock.mockRejectedValue(new Error('server'))

    render(<ProfileSkillQuestionnaire uid="user1" />)
    await user.click(
      await screen.findByRole('button', { name: /save answers/i })
    )

    expect(
      await screen.findByText(/couldn’t save your answers/i)
    ).toBeInTheDocument()
  })

  it('offers retry after a load error', async () => {
    const user = userEvent.setup()
    getMock.mockRejectedValueOnce(new Error('down'))
    getMock.mockResolvedValueOnce({ assessment: null })

    render(<ProfileSkillQuestionnaire uid="user1" />)

    await user.click(await screen.findByRole('button', { name: /retry/i }))
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole('button', { name: /save answers/i })
    ).toBeInTheDocument()
  })
})
