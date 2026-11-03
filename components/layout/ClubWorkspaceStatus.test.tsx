import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClubWorkspaceStatus } from './ClubWorkspaceStatus'

describe('ClubWorkspaceStatus', () => {
  it.each(['card', 'inline', 'nav'] as const)(
    'renders an accessible skeleton while loading (%s)',
    variant => {
      const { container } = render(
        <ClubWorkspaceStatus status={{ kind: 'loading' }} variant={variant} />
      )
      expect(screen.getByRole('status')).toHaveTextContent('Loading clubs…')
      expect(container.querySelector('.animate-pulse')).not.toBeNull()
    }
  )

  it('renders nothing once ready', () => {
    const { container } = render(
      <ClubWorkspaceStatus status={{ kind: 'ready' }} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
