import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page heading with eyebrow and description', () => {
    render(
      <PageHeader
        eyebrow="Super user"
        title="Schedules"
        description="Recurring match templates"
      />
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Schedules' })
    ).toBeInTheDocument()
    expect(screen.getByText('Super user')).toBeInTheDocument()
    expect(screen.getByText('Recurring match templates')).toBeInTheDocument()
  })

  it('renders actions only when provided', () => {
    const { rerender } = render(
      <PageHeader title="Users" actions={<button>New</button>} />
    )
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    rerender(<PageHeader title="Users" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
