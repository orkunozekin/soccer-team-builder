import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { auditLog } from '@/lib/services/auditService'
import { markInviteExpired } from '@/lib/services/clubService'

const mocks = vi.hoisted(() => ({ verify: vi.fn() }))

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    verify = mocks.verify
  },
}))

vi.mock('@/lib/services/clubService', () => ({
  markInviteExpired: vi.fn(),
}))

vi.mock('@/lib/services/auditService', () => ({
  auditLog: vi.fn(),
}))

function cronRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/invite-expiry', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  })
}

const bearer = { authorization: 'Bearer cron-secret' }

describe('POST /api/cron/invite-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', '')
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 without credentials', async () => {
    const response = await POST(cronRequest({ inviteId: 'inv1' }))
    expect(response.status).toBe(401)
    expect(markInviteExpired).not.toHaveBeenCalled()
  })

  it('returns 401 when the QStash signature does not verify', async () => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current')
    mocks.verify.mockResolvedValue(false)

    const response = await POST(
      cronRequest({ inviteId: 'inv1' }, { 'upstash-signature': 'bad' })
    )
    expect(response.status).toBe(401)
    expect(markInviteExpired).not.toHaveBeenCalled()
  })

  it('returns 400 when inviteId is missing', async () => {
    const response = await POST(cronRequest('not json', bearer))
    expect(response.status).toBe(400)
  })

  it('marks the invite expired and writes an audit entry', async () => {
    vi.mocked(markInviteExpired).mockResolvedValue({
      changed: true,
      clubId: 'c1',
      code: 'ABCD12',
    })

    const response = await POST(cronRequest({ inviteId: 'inv1' }, bearer))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, changed: true })
    expect(markInviteExpired).toHaveBeenCalledWith('inv1')
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cron.invite_expired',
        entityId: 'c1',
        source: 'cron',
      })
    )
  })

  it('does not audit a no-op delivery', async () => {
    vi.mocked(markInviteExpired).mockResolvedValue({ changed: false })

    const response = await POST(cronRequest({ inviteId: 'inv1' }, bearer))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      changed: false,
    })
    expect(auditLog).not.toHaveBeenCalled()
  })
})
