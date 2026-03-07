import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Button } from '@/components/ui/button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
})

test('calls onClick when clicked', async () => {
  const user = userEvent.setup()
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Submit</Button>)
  await user.click(screen.getByRole('button', { name: /submit/i }))
  expect(handleClick).toHaveBeenCalledTimes(1)
})

test('is disabled when disabled prop is true', () => {
  render(<Button disabled>Disabled</Button>)
  expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
})

test('shows loading state and hides children', () => {
  render(
    <Button loading>
      <span>Label</span>
    </Button>
  )
  const button = screen.getByRole('button')
  expect(button).toBeDisabled()
  // When loading, Button renders ButtonSpinner instead of children
  expect(screen.queryByText('Label')).toBeNull()
})
