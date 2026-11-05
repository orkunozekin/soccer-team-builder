import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SKILL_RANKING_CONFLICT_MESSAGE,
  SkillRankingBoard,
} from './SkillRankingBoard'
import {
  getClubSkillRankingAPI,
  saveClubSkillRankingAPI,
} from '@/lib/api/client'
import type {
  ClubSkillRankingDTO,
  SkillRankingMemberDTO,
  SkillRankingTiers,
} from '@/types/skill'

vi.mock('@/lib/api/client', () => ({
  getClubSkillRankingAPI: vi.fn(),
  saveClubSkillRankingAPI: vi.fn(),
}))

type RankingResponse = {
  ranking: ClubSkillRankingDTO
  members: SkillRankingMemberDTO[]
}

function tiers(partial: Partial<SkillRankingTiers> = {}): SkillRankingTiers {
  return { top: [], strong: [], average: [], developing: [], ...partial }
}

function member(
  userId: string,
  displayName: string,
  extra: Partial<SkillRankingMemberDTO> = {}
): SkillRankingMemberDTO {
  return {
    userId,
    displayName,
    position: null,
    assessmentScore: null,
    ...extra,
  }
}

function response(): RankingResponse {
  return {
    ranking: {
      tiers: tiers({ top: ['u1', 'u2'], average: ['u3'] }),
      version: 3,
    },
    members: [
      member('u1', 'Alice', { position: 'ST', assessmentScore: 2.75 }),
      member('u2', 'Bob', { position: 'GK' }),
      member('u3', 'Cara'),
      member('u4', 'Dan', { assessmentScore: 1 }),
    ],
  }
}

function group(name: string) {
  return screen.getByRole('region', { name: new RegExp(`^${name}`) })
}

function namesIn(name: string) {
  return within(group(name))
    .queryAllByRole('listitem')
    .map(li => li.querySelector('.font-medium')?.textContent)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('SkillRankingBoard', () => {
  beforeAll(() => {
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      scrollIntoView: () => {},
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClubSkillRankingAPI).mockResolvedValue(response())
  })

  it('renders tier groups and unranked members from the API', async () => {
    render(<SkillRankingBoard clubId="c1" />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenCalledWith('c1')
    expect(namesIn('Top')).toEqual(['Alice', 'Bob'])
    expect(namesIn('Strong')).toEqual([])
    expect(namesIn('Average')).toEqual(['Cara'])
    expect(namesIn('Unranked')).toEqual(['Dan'])
    expect(
      within(group('Strong')).getByText('No players in this tier.')
    ).toBeInTheDocument()
    expect(screen.getByText('ST · Questionnaire 2.8 / 4')).toBeInTheDocument()
    expect(screen.getByText('GK · No questionnaire')).toBeInTheDocument()
    expect(screen.getByText('Questionnaire 1.0 / 4')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Move Alice up' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Alice down' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Bob down' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Move Dan up' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Discard changes' })
    ).toBeDisabled()
  })

  it('saves a tier change and reorder as { tiers, version }', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockImplementation(
      async (_c, input) => ({
        success: true,
        ranking: { tiers: input.tiers, version: 4 },
      })
    )
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(screen.getByRole('combobox', { name: 'Tier for Dan' }))
    await user.click(await screen.findByRole('option', { name: 'Top' }))
    expect(namesIn('Top')).toEqual(['Alice', 'Bob', 'Dan'])
    expect(namesIn('Unranked')).toEqual([])
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move Dan up' }))
    expect(namesIn('Top')).toEqual(['Alice', 'Dan', 'Bob'])

    await user.click(screen.getByRole('combobox', { name: 'Tier for Cara' }))
    await user.click(await screen.findByRole('option', { name: 'Unranked' }))
    expect(namesIn('Unranked')).toEqual(['Cara'])

    await user.click(screen.getByRole('button', { name: 'Save ranking' }))

    expect(saveClubSkillRankingAPI).toHaveBeenCalledTimes(1)
    expect(saveClubSkillRankingAPI).toHaveBeenCalledWith('c1', {
      tiers: tiers({ top: ['u1', 'u4', 'u2'] }),
      version: 3,
    })
    expect(await screen.findByText('Ranking saved.')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()

    // The next save carries the version the last save returned.
    await user.click(screen.getByRole('button', { name: 'Move Bob up' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))
    expect(saveClubSkillRankingAPI).toHaveBeenLastCalledWith('c1', {
      tiers: tiers({ top: ['u1', 'u2', 'u4'] }),
      version: 4,
    })
  })

  it('disables Save and row controls while a save is in flight', async () => {
    const user = userEvent.setup()
    const save = deferred<Awaited<ReturnType<typeof saveClubSkillRankingAPI>>>()
    vi.mocked(saveClubSkillRankingAPI).mockReturnValue(save.promise)
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(screen.getByRole('button', { name: 'Move Bob up' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))

    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Alice up' })).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Tier for Dan' })
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))
    expect(saveClubSkillRankingAPI).toHaveBeenCalledTimes(1)

    save.resolve({
      success: true,
      ranking: {
        tiers: tiers({ top: ['u2', 'u1'], average: ['u3'] }),
        version: 4,
      },
    })
    expect(await screen.findByText('Ranking saved.')).toBeInTheDocument()
  })

  it('discards local edits', async () => {
    const user = userEvent.setup()
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(screen.getByRole('button', { name: 'Move Alice down' }))
    expect(namesIn('Top')).toEqual(['Bob', 'Alice'])

    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(namesIn('Top')).toEqual(['Alice', 'Bob'])
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()
    expect(saveClubSkillRankingAPI).not.toHaveBeenCalled()
  })

  it('shows the conflict message on 409 and keeps Save off until reloaded', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockRejectedValue(
      Object.assign(new Error(SKILL_RANKING_CONFLICT_MESSAGE), {
        status: 409,
        code: 'version_conflict',
      })
    )
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(screen.getByRole('button', { name: 'Move Bob up' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      SKILL_RANKING_CONFLICT_MESSAGE
    )
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()

    vi.mocked(getClubSkillRankingAPI).mockResolvedValueOnce({
      ranking: { tiers: tiers({ strong: ['u1'] }), version: 5 },
      members: response().members,
    })
    await user.click(screen.getByRole('button', { name: 'Reload' }))

    await waitFor(() => expect(namesIn('Strong')).toEqual(['Alice']))
    expect(getClubSkillRankingAPI).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.mocked(saveClubSkillRankingAPI).mockResolvedValueOnce({
      success: true,
      ranking: { tiers: tiers({ top: ['u1'] }), version: 6 },
    })
    await user.click(screen.getByRole('combobox', { name: 'Tier for Alice' }))
    await user.click(await screen.findByRole('option', { name: 'Top' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))
    expect(saveClubSkillRankingAPI).toHaveBeenLastCalledWith('c1', {
      tiers: tiers({ top: ['u1'] }),
      version: 5,
    })
  })

  it('shows the server message for other save errors and keeps edits', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockRejectedValue(
      Object.assign(new Error('Only active club members can be ranked'), {
        status: 400,
      })
    )
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(screen.getByRole('button', { name: 'Move Bob up' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))

    expect(
      await screen.findByText('Only active club members can be ranked')
    ).toBeInTheDocument()
    expect(namesIn('Top')).toEqual(['Bob', 'Alice'])
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeEnabled()
  })

  it('shows a retryable load error', async () => {
    const user = userEvent.setup()
    vi.mocked(getClubSkillRankingAPI).mockRejectedValueOnce(
      new Error('Failed to load skill ranking')
    )
    render(<SkillRankingBoard clubId="c1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load skill ranking'
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale response after clubId changes', async () => {
    const first = deferred<RankingResponse>()
    vi.mocked(getClubSkillRankingAPI)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        ranking: { tiers: tiers({ developing: ['z1'] }), version: 1 },
        members: [member('z1', 'Zoe')],
      })

    const { rerender } = render(<SkillRankingBoard clubId="c1" />)
    rerender(<SkillRankingBoard clubId="c2" />)

    expect(await screen.findByText('Zoe')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenLastCalledWith('c2')
    first.resolve(response())
    await waitFor(() => expect(namesIn('Developing')).toEqual(['Zoe']))
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('drops local edits and ignores an in-flight save when clubId changes', async () => {
    const user = userEvent.setup()
    const save = deferred<Awaited<ReturnType<typeof saveClubSkillRankingAPI>>>()
    vi.mocked(saveClubSkillRankingAPI).mockReturnValue(save.promise)
    vi.mocked(getClubSkillRankingAPI)
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce({
        ranking: { tiers: tiers(), version: 0 },
        members: [member('z1', 'Zoe')],
      })

    const { rerender } = render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')
    await user.click(screen.getByRole('button', { name: 'Move Bob up' }))
    await user.click(screen.getByRole('button', { name: 'Save ranking' }))

    rerender(<SkillRankingBoard clubId="c2" />)
    expect(await screen.findByText('Zoe')).toBeInTheDocument()
    save.reject(Object.assign(new Error('conflict'), { status: 409 }))

    await waitFor(() => expect(namesIn('Unranked')).toEqual(['Zoe']))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ranking' })).toBeDisabled()
  })
})
