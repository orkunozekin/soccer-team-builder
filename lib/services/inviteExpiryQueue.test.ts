import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleInviteExpiry } from '@/lib/services/inviteExpiryQueue'

const mocks = vi.hoisted(() => ({
  publishJSON: vi.fn(),
  clientOptions: [] as unknown[],
}))

vi.mock('@upstash/qstash', () => ({
  Client: class {
    constructor(options: unknown) {
      mocks.clientOptions.push(options)
    }
    publishJSON = mocks.publishJSON
  },
}))

const expiresAt = new Date('2026-10-01T05:00:00Z')

describe('scheduleInviteExpiry', () => {
  beforeEach(() => {
    mocks.publishJSON.mockReset()
    mocks.clientOptions.length = 0
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATOR', 'false')
    vi.stubEnv('QSTASH_TOKEN', 'test-token')
    vi.stubEnv('BASE_URL', 'https://app.example/')
    vi.stubEnv('QSTASH_API_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('publishes a delayed, deduplicated message to the cron route', async () => {
    mocks.publishJSON.mockResolvedValue({ messageId: 'msg_1' })

    await expect(
      scheduleInviteExpiry({ inviteId: 'inv1', expiresAt })
    ).resolves.toBe('msg_1')

    expect(mocks.publishJSON).toHaveBeenCalledWith({
      url: 'https://app.example/api/cron/invite-expiry',
      body: { inviteId: 'inv1' },
      notBefore: Math.floor(expiresAt.getTime() / 1000),
      deduplicationId: 'invite-expiry-inv1',
    })
    expect(mocks.clientOptions[0]).toEqual({
      token: 'test-token',
      baseUrl: 'https://qstash-us-east-1.upstash.io',
    })
  })

  it('skips publishing when emulators are on', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATOR', 'true')
    await expect(
      scheduleInviteExpiry({ inviteId: 'inv1', expiresAt })
    ).resolves.toBeNull()
    expect(mocks.publishJSON).not.toHaveBeenCalled()
  })

  it('skips publishing without a token or base URL', async () => {
    vi.stubEnv('QSTASH_TOKEN', '')
    await expect(
      scheduleInviteExpiry({ inviteId: 'inv1', expiresAt })
    ).resolves.toBeNull()

    vi.stubEnv('QSTASH_TOKEN', 'test-token')
    vi.stubEnv('BASE_URL', '')
    await expect(
      scheduleInviteExpiry({ inviteId: 'inv1', expiresAt })
    ).resolves.toBeNull()

    expect(mocks.publishJSON).not.toHaveBeenCalled()
  })
})
