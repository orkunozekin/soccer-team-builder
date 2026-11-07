import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from './page'
import { useAuthStore } from '@/store/authStore'

const getMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  getMySkillAssessmentAPI: (...args: unknown[]) => getMock(...args),
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

function signIn(uid: string) {
  useAuthMock.mockReturnValue({
    user: { uid, displayName: 'Player', email: 'p@example.com' },
    userData: { uid, displayName: 'Player', jerseyNumber: 7 },
    loading: false,
  })
  useAuthStore.setState({ user: { uid } as never })
}

describe('Profile page', () => {
  beforeEach(() => {
    getMock.mockReset()
    flagMock.mockReset()
    signIn('user1')
  })

  it('does not show the skill questionnaire, even with the flag on', () => {
    flagMock.mockReturnValue(true)
    render(<ProfilePage />)
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    expect(screen.queryByText(/skill questionnaire/i)).not.toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })
})
