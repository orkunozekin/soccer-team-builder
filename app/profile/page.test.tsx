import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './page'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'
import { useAuthStore } from '@/store/authStore'
import { resetSkillAssessmentStore } from '@/store/skillAssessmentStore'

const getMock = vi.fn()
const saveMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  getMySkillAssessmentAPI: (...args: unknown[]) => getMock(...args),
  saveMySkillAssessmentAPI: (...args: unknown[]) => saveMock(...args),
}))

const flagMock = vi.fn()
vi.mock('@/lib/flags/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => flagMock(key),
  useFeatureFlagReady: () => true,
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/firebase/auth', () => ({
  hasPasswordProvider: () => false,
}))

vi.mock('@/components/profile/AttendanceStatsCard', () => ({
  AttendanceStatsCard: () => null,
}))
vi.mock('@/components/profile/ProfileForm', () => ({
  ProfileForm: () => <div>Profile form</div>,
}))

const SAVED = {
  answers: { firstTouch: 2, passing: 2, fitness: 2, gameSense: 2 },
  updatedAt: '2026-11-01T00:00:00.000Z',
}

function signIn(uid: string) {
  useAuthMock.mockReturnValue({
    user: { uid, displayName: 'Player', email: 'p@example.com' },
    userData: { uid, displayName: 'Player', jerseyNumber: 7 },
    loading: false,
  })
  useAuthStore.setState({ user: { uid } as never })
}

async function openSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /skill questionnaire/i }))
}

describe('Profile skill questionnaire section', () => {
  beforeEach(() => {
    getMock.mockReset()
    saveMock.mockReset()
    flagMock.mockReset()
    resetSkillAssessmentStore()
    signIn('user1')
  })

  it('is hidden when the flag is off', () => {
    flagMock.mockReturnValue(false)
    render(<ProfilePage />)
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    expect(screen.queryByText(/skill questionnaire/i)).not.toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('loads saved answers and saves edits when the flag is on', async () => {
    const user = userEvent.setup()
    flagMock.mockImplementation(key => key === 'skill-balanced-teams')
    getMock.mockResolvedValue({ assessment: SAVED })
    saveMock.mockResolvedValue({
      success: true,
      assessment: { ...SAVED, answers: { ...SAVED.answers, firstTouch: 3 } },
    })

    render(<ProfilePage />)
    await openSection(user)

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
    flagMock.mockReturnValue(true)
    getMock.mockResolvedValue({ assessment: null })

    render(<ProfilePage />)
    await openSection(user)

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
    flagMock.mockReturnValue(true)
    getMock.mockResolvedValue({ assessment: SAVED })
    saveMock.mockRejectedValue(new Error('server'))

    render(<ProfilePage />)
    await openSection(user)
    await user.click(
      await screen.findByRole('button', { name: /save answers/i })
    )

    expect(
      await screen.findByText(/couldn’t save your answers/i)
    ).toBeInTheDocument()
  })

  it('offers retry after a load error', async () => {
    const user = userEvent.setup()
    flagMock.mockReturnValue(true)
    getMock.mockRejectedValueOnce(new Error('down'))
    getMock.mockResolvedValueOnce({ assessment: null })

    render(<ProfilePage />)
    await openSection(user)

    await user.click(await screen.findByRole('button', { name: /retry/i }))
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole('button', { name: /save answers/i })
    ).toBeInTheDocument()
  })
})
