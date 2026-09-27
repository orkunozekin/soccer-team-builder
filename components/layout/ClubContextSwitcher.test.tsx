import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClubContextSwitcher } from './ClubContextSwitcher'
import type { ClubMembershipWithClub } from '@/types/club'

function membership(
  clubId: string,
  name: string,
  role: ClubMembershipWithClub['role'] = 'player'
): ClubMembershipWithClub {
  return {
    id: `${clubId}_u1`,
    clubId,
    userId: 'u1',
    role,
    status: 'active',
    joinedAt: new Date(),
    updatedAt: new Date(),
    club: {
      id: clubId,
      name,
      slug: clubId,
      settings: { allowPlayerInvites: false },
    },
  }
}

const many = [
  membership('alpha', 'Alpha FC'),
  membership('beta', 'Beta United', 'club_admin'),
  membership('gamma', 'Gamma Rovers'),
  membership('delta', 'Delta Athletic'),
  membership('epsilon', 'Epsilon City'),
]

function renderSwitcher(
  props: Partial<React.ComponentProps<typeof ClubContextSwitcher>> = {}
) {
  const onSwitch = vi.fn()
  render(
    <ClubContextSwitcher
      clubName="Alpha FC"
      role="player"
      clubId="alpha"
      memberships={many.slice(0, 2)}
      switching={false}
      showCreateClub={false}
      onSwitch={onSwitch}
      {...props}
    />
  )
  return { onSwitch }
}

describe('ClubContextSwitcher', () => {
  it('shows the current club and role on the trigger', () => {
    renderSwitcher()
    const trigger = screen.getByLabelText('Switch club')
    expect(trigger).toHaveTextContent('Alpha FC')
    expect(trigger).toHaveTextContent('Player')
  })

  it('lists memberships with a checkmark on the current club', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await user.click(screen.getByLabelText('Switch club'))
    const current = screen.getByRole('button', { name: /alpha fc/i })
    expect(current.querySelector('svg')).not.toBeNull()
    const other = screen.getByRole('button', { name: /beta united/i })
    expect(other.querySelector('svg')).toBeNull()
    expect(other).toHaveTextContent('Club admin')
  })

  it('hides search for a short membership list', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await user.click(screen.getByLabelText('Switch club'))
    expect(screen.queryByLabelText('Find club')).not.toBeInTheDocument()
  })

  it('filters memberships by name when the list is long', async () => {
    const user = userEvent.setup()
    renderSwitcher({ memberships: many })
    await user.click(screen.getByLabelText('Switch club'))
    await user.type(screen.getByLabelText('Find club'), 'gam')
    expect(
      screen.getByRole('button', { name: /gamma rovers/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /beta united/i })
    ).not.toBeInTheDocument()
  })

  it('clears the search after a club is selected', async () => {
    const user = userEvent.setup()
    renderSwitcher({ memberships: many })
    await user.click(screen.getByLabelText('Switch club'))
    await user.type(screen.getByLabelText('Find club'), 'gam')
    await user.click(screen.getByRole('button', { name: /gamma rovers/i }))
    await user.click(screen.getByLabelText('Switch club'))
    expect(screen.getByLabelText('Find club')).toHaveValue('')
    expect(
      screen.getByRole('button', { name: /beta united/i })
    ).toBeInTheDocument()
  })

  it('shows an empty result when nothing matches', async () => {
    const user = userEvent.setup()
    renderSwitcher({ memberships: many })
    await user.click(screen.getByLabelText('Switch club'))
    await user.type(screen.getByLabelText('Find club'), 'zzz')
    expect(screen.getByText('No clubs match.')).toBeInTheDocument()
  })

  it('calls onSwitch with the chosen club', async () => {
    const user = userEvent.setup()
    const { onSwitch } = renderSwitcher()
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /beta united/i }))
    expect(onSwitch).toHaveBeenCalledWith('beta')
  })

  it('always offers Join and gates Create club', async () => {
    const user = userEvent.setup()
    renderSwitcher()
    await user.click(screen.getByLabelText('Switch club'))
    expect(screen.getByRole('link', { name: 'Join a club' })).toHaveAttribute(
      'href',
      '/join'
    )
    expect(
      screen.queryByRole('link', { name: 'Create club' })
    ).not.toBeInTheDocument()
  })

  it('shows Create club when allowed', async () => {
    const user = userEvent.setup()
    renderSwitcher({ showCreateClub: true })
    await user.click(screen.getByLabelText('Switch club'))
    expect(screen.getByRole('link', { name: 'Create club' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
  })

  it('disables the trigger while a switch is in flight', () => {
    renderSwitcher({ switching: true })
    expect(screen.getByLabelText('Switch club')).toBeDisabled()
  })
})
