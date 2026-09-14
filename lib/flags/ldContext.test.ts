import { describe, expect, it } from 'vitest'
import { anonymousContext, contextFromAuth } from '@/lib/flags/ldContext'

describe('LaunchDarkly auth context', () => {
  it('builds an anonymous context used only when signed out', () => {
    expect(anonymousContext()).toEqual({
      kind: 'user',
      key: 'anonymous',
      anonymous: true,
    })
  })

  it('keys signed-in users by Firebase uid and attaches email', () => {
    expect(
      contextFromAuth('9LtC0s00e5Yzq73l3p5p9KRJT4a2', 'orkunozekin@gmail.com')
    ).toEqual({
      kind: 'user',
      key: '9LtC0s00e5Yzq73l3p5p9KRJT4a2',
      email: 'orkunozekin@gmail.com',
    })
  })

  it('omits email when auth has none', () => {
    expect(contextFromAuth('uid-1', null)).toEqual({
      kind: 'user',
      key: 'uid-1',
      email: undefined,
    })
  })
})
