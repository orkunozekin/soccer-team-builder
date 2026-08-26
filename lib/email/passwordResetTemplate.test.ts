import { describe, expect, it } from 'vitest'
import { buildPasswordResetEmailHtml } from './passwordResetTemplate'

describe('buildPasswordResetEmailHtml', () => {
  it('includes brand copy and escapes user-controlled values', () => {
    const html = buildPasswordResetEmailHtml({
      email: 'a<b>@club.test',
      resetLink: 'https://example.com/reset?x=1&y=2',
    })

    expect(html).toContain('Soccerville')
    expect(html).toContain('Reset your password')
    expect(html).toContain('a&lt;b&gt;@club.test')
    expect(html).toContain(
      'https://example.com/reset?x=1&amp;y=2'
    )
    expect(html).not.toContain('<b>')
  })
})
