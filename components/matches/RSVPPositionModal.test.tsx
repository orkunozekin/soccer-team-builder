import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RSVPPositionModal } from './RSVPPositionModal'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: () => <div>PositionSelector</div>,
}))

function Harness({
  showSkillStep,
  onConfirm,
}: {
  showSkillStep?: boolean
  onConfirm: (...args: unknown[]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      <RSVPPositionModal
        open={open}
        onOpenChange={setOpen}
        defaultPosition="ST"
        onConfirm={onConfirm}
        showSkillStep={showSkillStep}
      />
    </>
  )
}

async function answerAll(user: ReturnType<typeof userEvent.setup>) {
  for (const question of SKILL_QUESTIONNAIRE) {
    await user.click(
      screen.getByRole('radio', { name: question.options[1].label })
    )
  }
}

describe('RSVPPositionModal', () => {
  it('without the skill step, confirms from the position step as before', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    expect(screen.getByText('Select your position')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    expect(onConfirm).toHaveBeenCalledWith('ST', undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('with the skill step, Next shows the questionnaire and Confirm needs all answers', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness showSkillStep onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    expect(
      screen.queryByRole('button', { name: 'Confirm RSVP' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Your game')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirm RSVP' })
    expect(confirm).toBeDisabled()
    await answerAll(user)
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('ST', {
      firstTouch: 2,
      passing: 2,
      fitness: 2,
      gameSense: 2,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Skip confirms without answers; Back returns to position', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness showSkillStep onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Select your position')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[0].label,
      })
    )
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onConfirm).toHaveBeenCalledWith('ST', undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('resets the step and answers when reopened', async () => {
    const user = userEvent.setup()
    render(<Harness showSkillStep onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[0].label,
      })
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    expect(screen.getByText('Select your position')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[0].label,
      })
    ).not.toBeChecked()
  })
})
