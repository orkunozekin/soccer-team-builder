import { render, screen, waitFor } from '@testing-library/react'
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
  SkillRatings,
} from '@/types/skill'

vi.mock('@/lib/api/client', () => ({
  getClubSkillRankingAPI: vi.fn(),
  saveClubSkillRankingAPI: vi.fn(),
}))

type RankingResponse = {
  ranking: ClubSkillRankingDTO
  members: SkillRankingMemberDTO[]
}

function member(
  userId: string,
  displayName: string,
  position: string | null = null
): SkillRankingMemberDTO {
  return { userId, displayName, position }
}

function response(ratings: SkillRatings = { u1: 8, u3: 4 }): RankingResponse {
  return {
    ranking: { ratings, version: 3 },
    members: [
      member('u2', 'Bob', 'GK'),
      member('u1', 'Alice', 'ST'),
      member('u4', 'Dan'),
      member('u3', 'Cara'),
    ],
  }
}

function ratingBox(name: string) {
  return screen.getByRole('combobox', { name: `Rating for ${name}` })
}

async function rate(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string
) {
  await user.click(ratingBox(name))
  await user.click(await screen.findByRole('option', { name: option }))
}

function rowNames() {
  return screen
    .getAllByRole('listitem')
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

  it('lists members alphabetically with their 1–10 rating or Not rated', async () => {
    render(<SkillRankingBoard clubId="c1" />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenCalledWith('c1')
    expect(rowNames()).toEqual(['Alice', 'Bob', 'Cara', 'Dan'])
    expect(ratingBox('Alice')).toHaveTextContent('8')
    expect(ratingBox('Cara')).toHaveTextContent('4')
    expect(ratingBox('Bob')).toHaveTextContent('Not rated')
    expect(screen.getByText('2 of 4 rated')).toBeInTheDocument()
    expect(screen.getByText('GK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Discard changes' })
    ).toBeDisabled()
  })

  it('offers Not rated and every value from 1 to 10', async () => {
    const user = userEvent.setup()
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await user.click(ratingBox('Bob'))
    const options = (await screen.findAllByRole('option')).map(
      o => o.textContent
    )
    expect(options).toEqual([
      'Not rated',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ])
  })

  it('saves rating changes as { ratings, version }, including clearing one', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockImplementation(
      async (_c, input) => ({
        success: true,
        ranking: { ratings: input.ratings, version: 4 },
      })
    )
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await rate(user, 'Bob', '10')
    await rate(user, 'Cara', 'Not rated')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByText('2 of 4 rated')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(saveClubSkillRankingAPI).toHaveBeenCalledTimes(1)
    expect(saveClubSkillRankingAPI).toHaveBeenCalledWith('c1', {
      ratings: { u1: 8, u2: 10 },
      version: 3,
    })
    expect(await screen.findByText('Ratings saved.')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()

    // The next save carries the version the last save returned.
    await rate(user, 'Dan', '1')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))
    expect(saveClubSkillRankingAPI).toHaveBeenLastCalledWith('c1', {
      ratings: { u1: 8, u2: 10, u4: 1 },
      version: 4,
    })
  })

  it('treats picking the same rating back as no change', async () => {
    const user = userEvent.setup()
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await rate(user, 'Alice', '3')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await rate(user, 'Alice', '8')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
  })

  it('disables Save and rating pickers while a save is in flight', async () => {
    const user = userEvent.setup()
    const save = deferred<Awaited<ReturnType<typeof saveClubSkillRankingAPI>>>()
    vi.mocked(saveClubSkillRankingAPI).mockReturnValue(save.promise)
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await rate(user, 'Bob', '6')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
    expect(ratingBox('Dan')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))
    expect(saveClubSkillRankingAPI).toHaveBeenCalledTimes(1)

    save.resolve({
      success: true,
      ranking: { ratings: { u1: 8, u2: 6, u3: 4 }, version: 4 },
    })
    expect(await screen.findByText('Ratings saved.')).toBeInTheDocument()
  })

  it('discards local edits', async () => {
    const user = userEvent.setup()
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await rate(user, 'Alice', '2')
    expect(ratingBox('Alice')).toHaveTextContent('2')

    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(ratingBox('Alice')).toHaveTextContent('8')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
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

    await rate(user, 'Bob', '7')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      SKILL_RANKING_CONFLICT_MESSAGE
    )
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
    expect(ratingBox('Dan')).toBeDisabled()

    vi.mocked(getClubSkillRankingAPI).mockResolvedValueOnce({
      ranking: { ratings: { u1: 5 }, version: 5 },
      members: response().members,
    })
    await user.click(screen.getByRole('button', { name: 'Reload' }))

    await waitFor(() => expect(ratingBox('Alice')).toHaveTextContent('5'))
    expect(ratingBox('Bob')).toHaveTextContent('Not rated')
    expect(getClubSkillRankingAPI).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    vi.mocked(saveClubSkillRankingAPI).mockResolvedValueOnce({
      success: true,
      ranking: { ratings: { u1: 9 }, version: 6 },
    })
    await rate(user, 'Alice', '9')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))
    expect(saveClubSkillRankingAPI).toHaveBeenLastCalledWith('c1', {
      ratings: { u1: 9 },
      version: 5,
    })
  })

  it('shows the server message for other save errors and keeps edits', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockRejectedValue(
      Object.assign(new Error('Only active club members can be rated'), {
        status: 400,
      })
    )
    render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')

    await rate(user, 'Bob', '7')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(
      await screen.findByText('Only active club members can be rated')
    ).toBeInTheDocument()
    expect(ratingBox('Bob')).toHaveTextContent('7')
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeEnabled()
  })

  it('drops stored ratings for people who are no longer members', async () => {
    vi.mocked(getClubSkillRankingAPI).mockResolvedValue(
      response({ u1: 8, gone: 3 })
    )
    render(<SkillRankingBoard clubId="c1" />)
    expect(await screen.findByText('1 of 4 rated')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
  })

  it('shows a retryable load error', async () => {
    const user = userEvent.setup()
    vi.mocked(getClubSkillRankingAPI).mockRejectedValueOnce(
      new Error('Failed to load player ratings')
    )
    render(<SkillRankingBoard clubId="c1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load player ratings'
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
        ranking: { ratings: { z1: 2 }, version: 1 },
        members: [member('z1', 'Zoe')],
      })

    const { rerender } = render(<SkillRankingBoard clubId="c1" />)
    rerender(<SkillRankingBoard clubId="c2" />)

    expect(await screen.findByText('Zoe')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenLastCalledWith('c2')
    first.resolve(response())
    await waitFor(() => expect(rowNames()).toEqual(['Zoe']))
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('drops local edits and ignores an in-flight save when clubId changes', async () => {
    const user = userEvent.setup()
    const save = deferred<Awaited<ReturnType<typeof saveClubSkillRankingAPI>>>()
    vi.mocked(saveClubSkillRankingAPI).mockReturnValue(save.promise)
    vi.mocked(getClubSkillRankingAPI)
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce({
        ranking: { ratings: {}, version: 0 },
        members: [member('z1', 'Zoe')],
      })

    const { rerender } = render(<SkillRankingBoard clubId="c1" />)
    await screen.findByText('Alice')
    await rate(user, 'Bob', '7')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    rerender(<SkillRankingBoard clubId="c2" />)
    expect(await screen.findByText('Zoe')).toBeInTheDocument()
    save.reject(Object.assign(new Error('conflict'), { status: 409 }))

    await waitFor(() => expect(ratingBox('Zoe')).toHaveTextContent('Not rated'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
  })
})
