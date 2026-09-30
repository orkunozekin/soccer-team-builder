import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))

describe('ClubIndexPage', () => {
  beforeEach(() => {
    redirectMock.mockClear()
  })

  it('redirects /c/[slug] to /c/[slug]/matches', async () => {
    const { default: ClubIndexPage } = await import('./page')

    await expect(
      ClubIndexPage({ params: Promise.resolve({ slug: 'jax-state-soccer-club' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/c/jax-state-soccer-club/matches')

    expect(redirectMock).toHaveBeenCalledWith(
      '/c/jax-state-soccer-club/matches'
    )
  })

  it('falls back to /matches when the slug is empty', async () => {
    const { default: ClubIndexPage } = await import('./page')

    await expect(
      ClubIndexPage({ params: Promise.resolve({ slug: '   ' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/matches')

    expect(redirectMock).toHaveBeenCalledWith('/matches')
  })
})
