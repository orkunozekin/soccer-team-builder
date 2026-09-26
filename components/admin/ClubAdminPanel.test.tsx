import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'
import { ClubAdminPanel } from './ClubAdminPanel'

vi.mock('@/lib/api/client', () => ({
  createClubAPI: vi.fn(),
}))

describe('ClubAdminPanel', () => {
  it('omits the create form when club-creation is off', () => {
    const { container } = render(
      <FeatureFlagContext.Provider value={{ 'club-creation': false }}>
        <ClubAdminPanel />
      </FeatureFlagContext.Provider>
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Create club')).not.toBeInTheDocument()
  })

  it('shows the create form when club-creation is on', () => {
    render(
      <FeatureFlagContext.Provider value={{ 'club-creation': true }}>
        <ClubAdminPanel />
      </FeatureFlagContext.Provider>
    )

    expect(screen.getByRole('button', { name: 'Create club' })).toBeTruthy()
    expect(screen.getByLabelText('Club name')).toBeTruthy()
  })
})
