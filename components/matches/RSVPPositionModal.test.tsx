import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RSVPPositionModal, type SkillStepMode } from './RSVPPositionModal'
import { CODE_OF_CONDUCT_VERSION } from '@/lib/conduct/codeOfConduct'
import type { CodeOfConductStepMode } from '@/lib/conduct/useCodeOfConductStatus'
import { SKILL_QUESTIONNAIRE } from '@/lib/skill/scoring'

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: () => <div>PositionSelector</div>,
}))

function Harness({
  skillStep,
  skillError,
  conductStep,
  error,
  onConfirm,
}: {
  skillStep?: SkillStepMode
  skillError?: string | null
  conductStep?: CodeOfConductStepMode
  error?: string | null
  onConfirm: (...args: unknown[]) => void | boolean | Promise<void | boolean>
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
        skillStep={skillStep}
        skillError={skillError}
        conductStep={conductStep}
        error={error}
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
    render(<Harness skillStep="required" onConfirm={onConfirm} />)

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

  it('has no Skip: Confirm stays disabled until every question is answered; Back returns to position', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness skillStep="required" onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    await user.click(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[0].label,
      })
    )
    expect(screen.getByRole('button', { name: 'Confirm RSVP' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Select your position')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Confirm RSVP' })
    ).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('while checking, Next is disabled and there is no way to confirm', async () => {
    const user = userEvent.setup()
    render(<Harness skillStep="checking" onConfirm={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Confirm RSVP' })
    ).not.toBeInTheDocument()
  })

  it('stays open with the error and the answers when onConfirm resolves false', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(false)
    const { rerender } = render(
      <Harness skillStep="required" onConfirm={onConfirm} />
    )

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await answerAll(user)
    await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(
      <Harness
        skillStep="required"
        skillError="Couldn’t save your answers"
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Couldn’t save your answers'
    )
    expect(
      screen.getByRole('radio', {
        name: SKILL_QUESTIONNAIRE[0].options[1].label,
      })
    ).toBeChecked()
  })

  it('resets the step and answers when reopened', async () => {
    const user = userEvent.setup()
    render(<Harness skillStep="required" onConfirm={vi.fn()} />)

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

  describe('code of conduct step', () => {
    it('requires ticking the box, then confirms with the current version', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(<Harness conductStep="required" onConfirm={onConfirm} />)

      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText('Code of conduct')).toBeInTheDocument()
      expect(screen.getByText('Respect everyone')).toBeInTheDocument()
      const confirm = screen.getByRole('button', { name: 'Confirm RSVP' })
      expect(confirm).toBeDisabled()

      await user.click(
        screen.getByRole('checkbox', { name: /i agree to follow/i })
      )
      await user.click(confirm)
      expect(onConfirm).toHaveBeenCalledWith(
        'ST',
        undefined,
        CODE_OF_CONDUCT_VERSION
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('waits on the position step while still checking', async () => {
      const user = userEvent.setup()
      render(<Harness conductStep="checking" onConfirm={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Confirm RSVP' })
      ).not.toBeInTheDocument()
    })

    it('comes after the skill step and Back returns to it', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <Harness
          skillStep="required"
          conductStep="required"
          onConfirm={onConfirm}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByText('Your game')).toBeInTheDocument()
      const next = screen.getByRole('button', { name: 'Next' })
      expect(next).toBeDisabled()
      await answerAll(user)
      await user.click(next)
      expect(screen.getByText('Code of conduct')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(screen.getByText('Your game')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(
        screen.getByRole('checkbox', { name: /i agree to follow/i })
      )
      await user.click(screen.getByRole('button', { name: 'Confirm RSVP' }))
      expect(onConfirm).toHaveBeenCalledWith(
        'ST',
        expect.objectContaining({ firstTouch: 2 }),
        CODE_OF_CONDUCT_VERSION
      )
    })

    it('starts unticked each time the modal opens', async () => {
      const user = userEvent.setup()
      render(<Harness conductStep="required" onConfirm={() => false} />)
      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(
        screen.getByRole('checkbox', { name: /i agree to follow/i })
      )
      await user.click(screen.getByRole('button', { name: 'Close' }))
      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      expect(
        screen.getByRole('checkbox', { name: /i agree to follow/i })
      ).not.toBeChecked()
    })

    it('shows an error passed in on any step', async () => {
      const user = userEvent.setup()
      render(
        <Harness
          conductStep="required"
          error="Agree to the code of conduct to RSVP."
          onConfirm={vi.fn()}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open modal' }))
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Agree to the code of conduct to RSVP.'
      )
    })
  })
})
