import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthFooterLink, AuthPageShell } from './AuthPageShell'

describe('AuthPageShell', () => {
  it('renders the hero, a labelled form panel and the footer', () => {
    render(
      <AuthPageShell
        title="Show up."
        description="Balanced teams, automatically."
        panelTitle="Sign in"
        footer={<AuthFooterLink href="/register">Sign up</AuthFooterLink>}
      >
        <form aria-label="credentials" />
      </AuthPageShell>
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Show up.' })
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sign in' })).toContainElement(
      screen.getByRole('form', { name: 'credentials' })
    )
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/register'
    )
  })
})
